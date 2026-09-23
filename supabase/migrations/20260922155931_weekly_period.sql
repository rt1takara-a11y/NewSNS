-- Switch the public identity boundary to Monday 00:00 Asia/Tokyo.
-- Existing monthly profiles remain private retention data and are no longer visible.
begin;

create function reme_private.period() returns text
language sql stable set search_path = '' as $$
  select to_char(statement_timestamp() at time zone 'Asia/Tokyo', 'IYYY-"W"IW');
$$;

create function reme_private.next_reset_at() returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('week', statement_timestamp() at time zone 'Asia/Tokyo')
          + interval '1 week') at time zone 'Asia/Tokyo';
$$;

create or replace function reme_private.epoch() returns text
language sql stable set search_path = '' as $$
  select reme_private.period() || ':' || generation::text
  from reme_private.settings where singleton;
$$;

create or replace function public.reme_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_epoch text; v_result jsonb;
begin
 v_me := reme_private.ensure_profile(); v_epoch := reme_private.epoch();
 with visible_posts as (
 select p.* from reme_private.posts p where not p.hidden and reme_private.visible(v_me,p.author)
 order by p.created_at desc, p.id desc limit 100
 )
 select jsonb_build_object(
 'period',split_part(v_epoch,':',1),'epoch',v_epoch,
 'serverNow',floor(extract(epoch from statement_timestamp())*1000),
 'nextResetAt',floor(extract(epoch from reme_private.next_reset_at())*1000),
 'me',(select reme_private.profile_json(p) from reme_private.profiles p where p.id=v_me),
 'people',coalesce((select jsonb_agg(reme_private.profile_json(p) order by p.created_at desc) from reme_private.profiles p
 where p.id<>v_me and reme_private.visible(v_me,p.id)), '[]'::jsonb),
 'following',coalesce((select jsonb_agg(f.target) from reme_private.follows f where f.actor=v_me and reme_private.visible(v_me,f.target)), '[]'::jsonb),
 'blocked',coalesce((select jsonb_agg(reme_private.profile_json(p)) from reme_private.blocks b join reme_private.profiles p on p.id=b.target where b.actor=v_me and p.epoch=v_epoch), '[]'::jsonb),
 'posts',coalesce((select jsonb_agg(jsonb_build_object(
 'id',p.id,'authorPublicId',p.author,'body',p.body,'createdAt',floor(extract(epoch from p.created_at)*1000),
 'likedBy',coalesce((select jsonb_agg(l.actor) from reme_private.likes l where l.post_id=p.id and reme_private.visible(v_me,l.actor)), '[]'::jsonb),
 'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'authorPublicId',r.author,'body',r.body,'createdAt',floor(extract(epoch from r.created_at)*1000)) order by r.created_at,r.id)
 from reme_private.replies r where r.post_id=p.id and not r.hidden and reme_private.visible(v_me,r.author)), '[]'::jsonb)
 ) order by p.created_at desc,p.id desc) from visible_posts p), '[]'::jsonb)
 ) into v_result;
 return v_result;
end;
$$;

revoke all on function reme_private.period(), reme_private.next_reset_at() from public, anon, authenticated;

commit;
