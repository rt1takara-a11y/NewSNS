-- Additive read API: monthly public profiles only, filtered for this viewer.
begin;
create index follows_target_actor on reme_private.follows(target, actor);

-- Definer is required because browser roles cannot access the private schema.
-- Identity is derived from the JWT; callers never supply an internal account ID.
create function public.reme_connections(target_public_id uuid, expected_epoch text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_epoch text; v_result jsonb;
begin
  v_me := reme_private.ensure_profile();
  v_epoch := reme_private.epoch();
  if expected_epoch is distinct from v_epoch then raise exception 'PERIOD_CHANGED'; end if;
  if not reme_private.visible(v_me, target_public_id) then raise exception 'NOT_FOUND'; end if;

  select jsonb_build_object(
    'epoch', v_epoch,
    'targetPublicId', target_public_id,
    'following', coalesce((
      select jsonb_agg(reme_private.profile_json(p) order by p.display_name, p.id)
      from reme_private.follows f join reme_private.profiles p on p.id = f.target
      where f.actor = target_public_id
        and reme_private.visible(v_me, p.id)
        and reme_private.visible(target_public_id, p.id)
    ), '[]'::jsonb),
    'followers', coalesce((
      select jsonb_agg(reme_private.profile_json(p) order by p.display_name, p.id)
      from reme_private.follows f join reme_private.profiles p on p.id = f.actor
      where f.target = target_public_id
        and reme_private.visible(v_me, p.id)
        and reme_private.visible(target_public_id, p.id)
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.reme_connections(uuid, text) from public, anon;
grant execute on function public.reme_connections(uuid, text) to authenticated;
commit;
