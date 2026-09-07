create extension if not exists pgcrypto;

create table if not exists public.food_art_items (
  canonical_id text primary key,
  normalized_name text not null,
  display_name text not null,
  description text,
  ingredients text,
  serving_description text,
  source_fingerprint text not null,
  location_ids text[] not null default '{}',
  station_names text[] not null default '{}',
  last_menu_date date not null,
  last_seen_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','generating','ready','stale','needs_review','failed')),
  current_asset_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_art_assets (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null references public.food_art_items(canonical_id) on delete cascade,
  version integer not null check (version > 0),
  source_fingerprint text not null,
  object_path text not null unique,
  public_url text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  format text not null check (format = 'png'),
  checksum_sha256 text not null,
  generator_model text not null,
  prompt text not null,
  quality_status text not null default 'technical_pass' check (quality_status in ('technical_pass','needs_review','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (canonical_id, source_fingerprint)
);

alter table public.food_art_items
  drop constraint if exists food_art_items_current_asset_id_fkey;
alter table public.food_art_items
  add constraint food_art_items_current_asset_id_fkey
  foreign key (current_asset_id) references public.food_art_assets(id) on delete set null;

create table if not exists public.food_art_jobs (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null references public.food_art_items(canonical_id) on delete cascade,
  source_fingerprint text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  worker_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canonical_id, source_fingerprint)
);

create table if not exists public.food_art_observations (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null references public.food_art_items(canonical_id) on delete cascade,
  source_fingerprint text not null,
  menu_date date not null,
  location_id text not null,
  station_id text not null,
  station_name text,
  provider_item_id text not null,
  display_name text not null,
  observed_at timestamptz not null default now(),
  unique (menu_date, location_id, station_id, provider_item_id)
);

create index if not exists food_art_items_status_idx on public.food_art_items(status);
create index if not exists food_art_assets_canonical_idx on public.food_art_assets(canonical_id, version desc);
create index if not exists food_art_jobs_claim_idx on public.food_art_jobs(status, run_after, created_at);
create index if not exists food_art_observations_canonical_idx on public.food_art_observations(canonical_id, menu_date desc);

create or replace function public.claim_food_art_jobs(p_limit integer, p_worker_id text)
returns setof public.food_art_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select id
    from public.food_art_jobs
    where status = 'queued'
      and run_after <= now()
    order by created_at
    for update skip locked
    limit greatest(0, least(p_limit, 10))
  ), claimed as (
    update public.food_art_jobs j
    set status = 'running',
        attempts = j.attempts + 1,
        locked_at = now(),
        worker_id = p_worker_id,
        last_error = null,
        updated_at = now()
    from claimable c
    where j.id = c.id
    returning j.*
  )
  select * from claimed;
end;
$$;

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
  update public.food_art_items
  set current_asset_id = p_asset_id,
      source_fingerprint = p_source_fingerprint,
      status = 'ready',
      updated_at = now()
  where canonical_id = p_canonical_id;

  update public.food_art_jobs
  set status = 'completed',
      locked_at = null,
      worker_id = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.fail_food_art_job(
  p_job_id uuid,
  p_canonical_id text,
  p_error text,
  p_retry boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_attempts integer;
begin
  select attempts into current_attempts from public.food_art_jobs where id = p_job_id;

  update public.food_art_jobs
  set status = case when p_retry and coalesce(current_attempts, 0) < 3 then 'queued' else 'failed' end,
      run_after = case when p_retry and coalesce(current_attempts, 0) < 3
        then now() + make_interval(mins => least(30, power(2, greatest(0, coalesce(current_attempts, 1) - 1))::integer * 2))
        else run_after end,
      locked_at = null,
      worker_id = null,
      last_error = left(p_error, 4000),
      updated_at = now()
  where id = p_job_id;

  update public.food_art_items
  set status = case when p_retry and coalesce(current_attempts, 0) < 3 then 'queued' else 'failed' end,
      updated_at = now()
  where canonical_id = p_canonical_id;
end;
$$;

revoke all on function public.claim_food_art_jobs(integer, text) from public;
revoke all on function public.complete_food_art_job(uuid, uuid, text, text) from public;
revoke all on function public.fail_food_art_job(uuid, text, text, boolean) from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('falcon-food-art', 'falcon-food-art', true, 26214400, array['image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
