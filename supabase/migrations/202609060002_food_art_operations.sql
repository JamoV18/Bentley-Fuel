create table if not exists public.food_art_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.food_art_jobs(id) on delete cascade,
  job_attempt integer not null check (job_attempt > 0),
  canonical_id text not null,
  source_fingerprint text not null,
  candidate_number integer not null check (candidate_number > 0),
  outcome text not null check (outcome in ('accepted','qa_rejected','validation_rejected','generation_error','qa_error')),
  generator_model text,
  qa_model text,
  qa_result jsonb,
  error text,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  checksum_sha256 text,
  review_object_path text,
  review_status text check (review_status is null or review_status in ('open','dismissed','regeneration_requested')),
  created_at timestamptz not null default now(),
  unique (job_id, job_attempt, candidate_number),
  foreign key (canonical_id, source_fingerprint)
    references public.food_art_sources(canonical_id, source_fingerprint) on delete cascade
);

create index if not exists food_art_attempts_source_idx
  on public.food_art_attempts(canonical_id, source_fingerprint, created_at desc);
create index if not exists food_art_attempts_review_idx
  on public.food_art_attempts(review_status, created_at desc)
  where review_status is not null;
create index if not exists food_art_attempts_outcome_idx
  on public.food_art_attempts(outcome, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('falcon-food-art-review', 'falcon-food-art-review', false, 26214400, array['image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

    update public.food_art_jobs
    set status = next_status,
        run_after = case when next_status = 'queued' then now() else run_after end,
        locked_at = null,
        worker_id = null,
        last_error = format('Recovered abandoned worker lock after at least %s minutes.', stale_minutes),
        updated_at = now()
    where id = candidate.id;

    update public.food_art_items
    set status = case when next_status = 'queued' then 'queued' else 'failed' end,
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
      from (
        select status, count(*)::integer as total
        from public.food_art_items
        group by status
      ) counts
    ), '{}'::jsonb),
    'jobCounts', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select status, count(*)::integer as total
        from public.food_art_jobs
        group by status
      ) counts
    ), '{}'::jsonb),
    'assetQualityCounts', coalesce((
      select jsonb_object_agg(quality_status, total)
      from (
        select quality_status, count(*)::integer as total
        from public.food_art_assets
        group by quality_status
      ) counts
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
      select min(created_at)
      from public.food_art_jobs
      where status = 'queued'
    ),
    'oldestQueuedAgeSeconds', (
      select case
        when min(created_at) is null then null
        else floor(extract(epoch from (now() - min(created_at))))::integer
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

drop function if exists public.fail_food_art_job(uuid, text, text, boolean);

create or replace function public.fail_food_art_job(
  p_job_id uuid,
  p_canonical_id text,
  p_error text,
  p_retry boolean default true,
  p_max_attempts integer default 3
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
  job_fingerprint text;
  next_status text;
  item_terminal_status text;
  max_attempts integer := greatest(1, least(coalesce(p_max_attempts, 3), 6));
begin
  select attempts, source_fingerprint
  into current_attempts, job_fingerprint
  from public.food_art_jobs
  where id = p_job_id and canonical_id = p_canonical_id;

  next_status := case
    when p_retry and coalesce(current_attempts, 0) < max_attempts then 'queued'
    else 'failed'
  end;

  update public.food_art_jobs
  set status = next_status,
      run_after = case when next_status = 'queued'
        then now() + make_interval(mins => least(30, power(2, greatest(0, coalesce(current_attempts, 1) - 1))::integer * 2))
        else run_after end,
      locked_at = null,
      worker_id = null,
      last_error = left(p_error, 4000),
      updated_at = now()
  where id = p_job_id;

  item_terminal_status := case
    when exists (
      select 1
      from public.food_art_attempts
      where canonical_id = p_canonical_id
        and source_fingerprint = job_fingerprint
        and review_status = 'open'
    ) then 'needs_review'
    else 'failed'
  end;

  update public.food_art_items
  set status = case when next_status = 'queued' then 'queued' else item_terminal_status end,
      updated_at = now()
  where canonical_id = p_canonical_id
    and source_fingerprint = job_fingerprint
    and current_asset_id is null;
end;
$$;

create or replace function public.operator_food_art_review_action(
  p_attempt_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt_row public.food_art_attempts%rowtype;
  normalized_action text := lower(trim(coalesce(p_action, '')));
begin
  select * into attempt_row
  from public.food_art_attempts
  where id = p_attempt_id
  for update;

  if attempt_row.id is null then
    raise exception 'Food Art review attempt not found';
  end if;

  if attempt_row.review_status is null then
    raise exception 'Food Art attempt is not reviewable';
  end if;

  if normalized_action = 'regenerate' then
    update public.food_art_attempts
    set review_status = 'regeneration_requested'
    where id = p_attempt_id;

    insert into public.food_art_jobs (
      canonical_id,
      source_fingerprint,
      status,
      attempts,
      run_after,
      locked_at,
      worker_id,
      last_error,
      updated_at
    ) values (
      attempt_row.canonical_id,
      attempt_row.source_fingerprint,
      'queued',
      0,
      now(),
      null,
      null,
      'Operator requested regeneration after private QA review.',
      now()
    )
    on conflict (canonical_id, source_fingerprint) do update
    set status = 'queued',
        attempts = 0,
        run_after = now(),
        locked_at = null,
        worker_id = null,
        last_error = 'Operator requested regeneration after private QA review.',
        updated_at = now();

    update public.food_art_items
    set status = 'queued',
        updated_at = now()
    where canonical_id = attempt_row.canonical_id
      and source_fingerprint = attempt_row.source_fingerprint
      and current_asset_id is null;

  elsif normalized_action = 'dismiss' then
    update public.food_art_attempts
    set review_status = 'dismissed'
    where id = p_attempt_id;

    if not exists (
      select 1
      from public.food_art_attempts
      where canonical_id = attempt_row.canonical_id
        and source_fingerprint = attempt_row.source_fingerprint
        and review_status = 'open'
    ) then
      update public.food_art_items
      set status = 'failed',
          updated_at = now()
      where canonical_id = attempt_row.canonical_id
        and source_fingerprint = attempt_row.source_fingerprint
        and current_asset_id is null
        and status = 'needs_review';
    end if;
  else
    raise exception 'Unsupported Food Art review action';
  end if;

  return jsonb_build_object(
    'attemptId', attempt_row.id,
    'action', normalized_action,
    'canonicalId', attempt_row.canonical_id,
    'sourceFingerprint', attempt_row.source_fingerprint
  );
end;
$$;

revoke all on function public.recover_abandoned_food_art_jobs(integer, integer) from public;
revoke all on function public.food_art_operational_snapshot(integer) from public;
revoke all on function public.fail_food_art_job(uuid, text, text, boolean, integer) from public;
revoke all on function public.operator_food_art_review_action(uuid, text) from public;
