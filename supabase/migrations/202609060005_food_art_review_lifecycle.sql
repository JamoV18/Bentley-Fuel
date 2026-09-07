create or replace function public.complete_food_art_job(
  p_job_id uuid,
  p_asset_id uuid,
  p_canonical_id text,
  p_source_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only make an asset the name-level current pointer if this exact recipe is
  -- still current. A DineOnCampus change that lands while generation is in
  -- flight must never be overwritten by the older job finishing afterward.
  update public.food_art_items
  set current_asset_id = p_asset_id,
      status = 'ready',
      updated_at = now()
  where canonical_id = p_canonical_id
    and source_fingerprint = p_source_fingerprint;

  update public.food_art_jobs
  set status = 'completed',
      locked_at = null,
      worker_id = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id
    and canonical_id = p_canonical_id
    and source_fingerprint = p_source_fingerprint;

  -- Once this exact recipe has a QA-approved production asset, its older
  -- rejected candidates are no longer actionable and should leave the open
  -- operator queue. Their telemetry/private images remain preserved.
  update public.food_art_attempts
  set review_status = 'dismissed'
  where canonical_id = p_canonical_id
    and source_fingerprint = p_source_fingerprint
    and review_status = 'open';
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
    -- One regeneration request resolves every currently open rejection for the
    -- same recipe version; the next candidate must still clear automatic QA.
    update public.food_art_attempts
    set review_status = 'regeneration_requested'
    where canonical_id = attempt_row.canonical_id
      and source_fingerprint = attempt_row.source_fingerprint
      and review_status = 'open';

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

revoke all on function public.complete_food_art_job(uuid, uuid, text, text) from public;
revoke all on function public.operator_food_art_review_action(uuid, text) from public;
grant execute on function public.complete_food_art_job(uuid, uuid, text, text) to service_role;
grant execute on function public.operator_food_art_review_action(uuid, text) to service_role;
