-- Food Art registry/queue metadata is server infrastructure. Prompts, QA results,
-- failure messages, and rejected-candidate metadata must never be readable or
-- writable directly by student clients.
alter table public.food_art_items enable row level security;
alter table public.food_art_sources enable row level security;
alter table public.food_art_assets enable row level security;
alter table public.food_art_jobs enable row level security;
alter table public.food_art_observations enable row level security;
alter table public.food_art_attempts enable row level security;

revoke all on table public.food_art_items from anon, authenticated;
revoke all on table public.food_art_sources from anon, authenticated;
revoke all on table public.food_art_assets from anon, authenticated;
revoke all on table public.food_art_jobs from anon, authenticated;
revoke all on table public.food_art_observations from anon, authenticated;
revoke all on table public.food_art_attempts from anon, authenticated;

grant select, insert, update, delete on table public.food_art_items to service_role;
grant select, insert, update, delete on table public.food_art_sources to service_role;
grant select, insert, update, delete on table public.food_art_assets to service_role;
grant select, insert, update, delete on table public.food_art_jobs to service_role;
grant select, insert, update, delete on table public.food_art_observations to service_role;
grant select, insert, update, delete on table public.food_art_attempts to service_role;
