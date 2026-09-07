create or replace function public.recover_abandoned_food_art_jobs(
  p_stale_after_minutes integer default 45,
  p_max_attempts integer default 3
)
returns table(requeued integer, failed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  next_status text;
  terminal_item_status text;
  stale_minutes integer := greatest(15, least(coalesce(p_stale_after_minutes, 45), 180));
  max_attempts integer := greatest(1, least(coalesce(p_max_attempts, 3), 6));
begin
  requeued := 0;
  failed := 0;

  for candidate in
    select id, canonical_id, source_fingerprint, attempts
    from public.food_art_jobs
    where status = 'running'
      and locked_at is not null
      and locked_at < now() - make_interval(mins => stale_minutes)
    order by locked_at
    for update skip locked
  loop
    next_status := case when candidate.attempts < max_attempts then 'queued' else 'failed' end;
    terminal_item_status := case
      when exists (
        select 1
        from public.food_art_attempts
        where canonical_id = candidate.canonical_id
          and source_fingerprint = candidate.source_fingerprint
          and review_status = 'open'
      ) then 'needs_review'
      else 'failed'
    end;

    update public.food_art_jobs
    set status = next_status,
        run_after = case when next_status = 'queued' then now() else run_after end,
        locked_at = null,
        worker_id = null,
        last_error = format('Recovered abandoned worker lock after at least %s minutes.', stale_minutes),
        updated_at = now()
    where id = candidate.id;

    update public.food_art_items
    set status = case when next_status = 'queued' then 'queued' else terminal_item_status end,
        updated_at = now()
    where canonical_id = candidate.canonical_id
      and source_fingerprint = candidate.source_fingerprint
      and current_asset_id is null;

    if next_status = 'queued' then
      requeued := requeued + 1;
    else
      failed := failed + 1;
    end if;
  end loop;

  return next;
end;
$$;

create or replace function public.food_art_operational_snapshot(
  p_stale_after_minutes integer default 45
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'itemCounts', coalesce((
      select jsonb_object_agg(status, total)
      from (select status, count(*)::integer as total from public.food_art_items group by status) counts
    ), '{}'::jsonb),
    'jobCounts', coalesce((
      select jsonb_object_agg(status, total)
      from (select status, count(*)::integer as total from public.food_art_jobs group by status) counts
    ), '{}'::jsonb),
    'assetQualityCounts', coalesce((
      select jsonb_object_agg(quality_status, total)
      from (select quality_status, count(*)::integer as total from public.food_art_assets group by quality_status) counts
    ), '{}'::jsonb),
    'reviewCounts', coalesce((
      select jsonb_object_agg(review_status, total)
      from (
        select review_status, count(*)::integer as total
        from public.food_art_attempts
        where review_status is not null
        group by review_status
      ) counts
    ), '{}'::jsonb),
    'oldestQueuedAt', (
      select min(updated_at)
      from public.food_art_jobs
      where status = 'queued'
    ),
    'oldestQueuedAgeSeconds', (
      select case
        when min(updated_at) is null then null
        else floor(extract(epoch from (now() - min(updated_at))))::integer
      end
      from public.food_art_jobs
      where status = 'queued'
    ),
    'staleRunningJobs', (
      select count(*)::integer
      from public.food_art_jobs
      where status = 'running'
        and locked_at is not null
        and locked_at < now() - make_interval(mins => greatest(15, least(coalesce(p_stale_after_minutes, 45), 180)))
    ),
    'attempts24h', jsonb_build_object(
      'total', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours'),
      'accepted', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours' and outcome = 'accepted'),
      'qaRejected', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours' and outcome = 'qa_rejected'),
      'validationRejected', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours' and outcome = 'validation_rejected'),
      'generationErrors', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours' and outcome = 'generation_error'),
      'qaErrors', (select count(*)::integer from public.food_art_attempts where created_at >= now() - interval '24 hours' and outcome = 'qa_error')
    ),
    'recentFailures', coalesce((
      select jsonb_agg(to_jsonb(failures))
      from (
        select id, canonical_id, source_fingerprint, attempts, last_error, updated_at
        from public.food_art_jobs
        where status = 'failed'
           or (status = 'queued' and last_error is not null)
        order by updated_at desc
        limit 20
      ) failures
    ), '[]'::jsonb)
  );
$$;

-- RPCs are not callable by anonymous/authenticated clients. The server-side
-- service-role connection is the only application role allowed to operate the
-- queue or review rejected candidates.
revoke all on function public.claim_food_art_jobs(integer, text) from public;
revoke all on function public.complete_food_art_job(uuid, uuid, text, text) from public;
revoke all on function public.fail_food_art_job(uuid, text, text, boolean, integer) from public;
revoke all on function public.recover_abandoned_food_art_jobs(integer, integer) from public;
revoke all on function public.food_art_operational_snapshot(integer) from public;
revoke all on function public.operator_food_art_review_action(uuid, text) from public;

grant execute on function public.claim_food_art_jobs(integer, text) to service_role;
grant execute on function public.complete_food_art_job(uuid, uuid, text, text) to service_role;
grant execute on function public.fail_food_art_job(uuid, text, text, boolean, integer) to service_role;
grant execute on function public.recover_abandoned_food_art_jobs(integer, integer) to service_role;
grant execute on function public.food_art_operational_snapshot(integer) to service_role;
grant execute on function public.operator_food_art_review_action(uuid, text) to service_role;
