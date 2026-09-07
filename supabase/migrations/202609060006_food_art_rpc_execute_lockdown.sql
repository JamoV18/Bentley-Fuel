-- Lock down Food Art SECURITY DEFINER RPCs so only the server service role can execute them.
revoke execute on function public.claim_food_art_jobs(integer, text) from public, anon, authenticated;
revoke execute on function public.complete_food_art_job(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.fail_food_art_job(uuid, text, text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.recover_abandoned_food_art_jobs(integer, integer) from public, anon, authenticated;
revoke execute on function public.food_art_operational_snapshot(integer) from public, anon, authenticated;
revoke execute on function public.operator_food_art_review_action(uuid, text) from public, anon, authenticated;

grant execute on function public.claim_food_art_jobs(integer, text) to service_role;
grant execute on function public.complete_food_art_job(uuid, uuid, text, text) to service_role;
grant execute on function public.fail_food_art_job(uuid, text, text, boolean, integer) to service_role;
grant execute on function public.recover_abandoned_food_art_jobs(integer, integer) to service_role;
grant execute on function public.food_art_operational_snapshot(integer) to service_role;
grant execute on function public.operator_food_art_review_action(uuid, text) to service_role;

-- Supabase Automatic RLS installs this administrative helper in public; it must
-- not remain callable from anon/authenticated PostgREST clients.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
