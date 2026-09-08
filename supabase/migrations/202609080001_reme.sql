-- RE:ME: private data, narrowly granted RPCs, server-owned identity and month.
begin;
create schema if not exists reme_private;
revoke all on schema reme_private from public, anon, authenticated;

create table reme_private.settings (
  singleton boolean primary key default true check (singleton),
  generation integer not null default 0 check (generation >= 0)
);
insert into reme_private.settings values (true, 0);
create table reme_private.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  window_at timestamptz not null default now(),
  writes integer not null default 0
);
create table reme_private.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references reme_private.accounts(id) on delete cascade,
  epoch text not null,
  display_name text not null default '' check (char_length(display_name) <= 30),
  icon text not null default '🙂',
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  unique (account_id, epoch)
);
create index profiles_epoch on reme_private.profiles(epoch);
create table reme_private.posts (
  id uuid primary key default gen_random_uuid(),
  author uuid not null references reme_private.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index posts_author on reme_private.posts(author, created_at desc);
create table reme_private.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references reme_private.posts(id) on delete cascade,
  author uuid not null references reme_private.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index replies_post on reme_private.replies(post_id, created_at);
create table reme_private.likes (
  actor uuid not null references reme_private.profiles(id) on delete cascade,
  post_id uuid not null references reme_private.posts(id) on delete cascade,
  primary key(actor, post_id)
);
create index likes_post on reme_private.likes(post_id);
create table reme_private.follows (
  actor uuid not null references reme_private.profiles(id) on delete cascade,
  target uuid not null references reme_private.profiles(id) on delete cascade,
  primary key(actor, target), check(actor <> target)
);
create table reme_private.blocks (
  actor uuid not null references reme_private.profiles(id) on delete cascade,
  target uuid not null references reme_private.profiles(id) on delete cascade,
  primary key(actor, target), check(actor <> target)
);
-- Independent evidence snapshot survives public-content deletion; never returned by RPC.
create table reme_private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null,
  subject_account uuid not null,
  subject_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  legal_hold boolean not null default false,
  resolved boolean not null default false,
  unique(reporter, subject_id)
);

-- RLS is defense in depth; no table is exposed to browser roles.
alter table reme_private.settings enable row level security;
alter table reme_private.accounts enable row level security;
alter table reme_private.profiles enable row level security;
alter table reme_private.posts enable row level security;
alter table reme_private.replies enable row level security;
alter table reme_private.likes enable row level security;
alter table reme_private.follows enable row level security;
alter table reme_private.blocks enable row level security;
alter table reme_private.reports enable row level security;
revoke all on all tables in schema reme_private from public, anon, authenticated;

create function reme_private.epoch() returns text language sql stable set search_path = '' as $$
 select to_char(statement_timestamp() at time zone 'Asia/Tokyo', 'YYYY-MM') || ':' || generation::text
 from reme_private.settings where singleton;
$$;
create function reme_private.ensure_profile() returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid; v_suspended boolean;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into reme_private.accounts(id) values(v_user) on conflict do nothing;
 select suspended into v_suspended from reme_private.accounts where id=v_user for update;
 if v_suspended then raise exception 'ACCOUNT_SUSPENDED'; end if;
 insert into reme_private.profiles(account_id,epoch) values(v_user,reme_private.epoch()) on conflict do nothing;
 select id into v_id from reme_private.profiles where account_id=v_user and epoch=reme_private.epoch();
 return v_id;
end;
$$;
create function reme_private.visible(v_actor uuid, v_target uuid) returns boolean language sql stable set search_path = '' as $$
 select exists(select 1 from reme_private.profiles p join reme_private.accounts a on a.id=p.account_id
 where p.id=v_target and p.epoch=reme_private.epoch() and not a.suspended)
 and not exists(select 1 from reme_private.blocks b where
 (b.actor=v_actor and b.target=v_target) or (b.actor=v_target and b.target=v_actor));
$$;
create function reme_private.profile_json(p reme_private.profiles) returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('publicId',p.id,'displayName',p.display_name,'icon',p.icon,'bio',p.bio);
$$;

create function public.reme_state() returns jsonb language plpgsql security definer set search_path = '' as $$
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
 'nextResetAt',floor(extract(epoch from ((date_trunc('month',statement_timestamp() at time zone 'Asia/Tokyo')+interval '1 month') at time zone 'Asia/Tokyo'))*1000),
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

-- Actor and month are derived from the verified Supabase JWT and database clock.
-- expected_epoch prevents stale tabs from accidentally publishing into the next month.
create function public.reme_mutate(action text, payload jsonb, expected_epoch text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_target uuid; v_post reme_private.posts; v_subject uuid; v_body text; v_id uuid; v_snapshot jsonb; v_user uuid;
begin
 v_me := reme_private.ensure_profile(); v_user := auth.uid();
 if expected_epoch is distinct from reme_private.epoch() then raise exception 'PERIOD_CHANGED'; end if;
 -- Per-account row lock held by ensure_profile serializes write quotas and toggles.
 update reme_private.accounts set writes=case when window_at < now()-interval '1 minute' then 1 else writes+1 end,
 window_at=case when window_at < now()-interval '1 minute' then now() else window_at end where id=v_user;
 if (select writes from reme_private.accounts where id=v_user)>30 then raise exception 'RATE_LIMITED'; end if;
 if action='profile' then
   if char_length(btrim(coalesce(payload->>'displayName',''))) not between 1 and 30 or char_length(coalesce(payload->>'bio',''))>160
      or not coalesce(payload->>'icon','')=any(array['🙂','🌱','🌙','🐟','☕️','🎧','🍋','🪁','🦊','🌸','⭐️','🐧']) then raise exception 'INVALID_INPUT'; end if;
   update reme_private.profiles set display_name=btrim(payload->>'displayName'),icon=payload->>'icon',bio=btrim(coalesce(payload->>'bio','')) where id=v_me;
 elsif action='post' then
   if (select display_name='' from reme_private.profiles where id=v_me) then raise exception 'PROFILE_REQUIRED'; end if;
   v_body := btrim(coalesce(payload->>'body',''));
   if char_length(v_body) not between 1 and 500 then raise exception 'INVALID_INPUT'; end if;
   v_id := (payload->>'id')::uuid; if v_id is null then raise exception 'INVALID_INPUT'; end if;
   -- A stable operation ID allows retry after a lost network response without duplicating content.
   insert into reme_private.posts(id,author,body) values(v_id,v_me,v_body) on conflict(id) do nothing;
   if not exists(select 1 from reme_private.posts where id=v_id and author=v_me and body=v_body) then raise exception 'INVALID_INPUT'; end if;
 elsif action in ('follow','block','unblock') then
   v_target := (payload->>'target')::uuid;
   if v_target=v_me or not exists(select 1 from reme_private.profiles where id=v_target and epoch=reme_private.epoch()) then raise exception 'NOT_FOUND'; end if;
   if action='follow' then
     if not reme_private.visible(v_me,v_target) then raise exception 'NOT_FOUND'; end if;
     if (payload->>'enabled')::boolean then insert into reme_private.follows values(v_me,v_target) on conflict do nothing;
     else delete from reme_private.follows where actor=v_me and target=v_target; end if;
   elsif action='block' then
     insert into reme_private.blocks values(v_me,v_target) on conflict do nothing;
     delete from reme_private.follows where (actor=v_me and target=v_target) or (actor=v_target and target=v_me);
   else delete from reme_private.blocks where actor=v_me and target=v_target; end if;
 elsif action in ('like','reply','report','delete_post') then
   select * into v_post from reme_private.posts where id=(payload->>'postId')::uuid and not hidden;
   if not found or not reme_private.visible(v_me,v_post.author) then raise exception 'NOT_FOUND'; end if;
   if action='like' then
     if (payload->>'enabled')::boolean then insert into reme_private.likes values(v_me,v_post.id) on conflict do nothing;
     else delete from reme_private.likes where actor=v_me and post_id=v_post.id; end if;
   elsif action='reply' then
     if (select display_name='' from reme_private.profiles where id=v_me) then raise exception 'PROFILE_REQUIRED'; end if;
     v_body:=btrim(coalesce(payload->>'body',''));
     if char_length(v_body) not between 1 and 500 then raise exception 'INVALID_INPUT'; end if;
     v_id:=(payload->>'id')::uuid; if v_id is null then raise exception 'INVALID_INPUT'; end if;
     insert into reme_private.replies(id,post_id,author,body) values(v_id,v_post.id,v_me,v_body) on conflict(id) do nothing;
     if not exists(select 1 from reme_private.replies where id=v_id and author=v_me and post_id=v_post.id and body=v_body) then raise exception 'INVALID_INPUT'; end if;
   elsif action='delete_post' then
     if v_post.author<>v_me then raise exception 'FORBIDDEN'; end if;
     update reme_private.posts set hidden=true where id=v_post.id;
   else
     v_body:=btrim(coalesce(payload->>'reason',''));
     if char_length(v_body) not between 1 and 500 then raise exception 'INVALID_INPUT'; end if;
     select account_id into v_subject from reme_private.profiles where id=v_post.author;
     v_snapshot:=jsonb_build_object('body',v_post.body,'createdAt',v_post.created_at,'epoch',reme_private.epoch(),'authorPublicId',v_post.author);
     insert into reme_private.reports(reporter,subject_account,subject_id,reason,snapshot)
     values(v_user,v_subject,v_post.id,v_body,v_snapshot) on conflict(reporter,subject_id) do nothing;
   end if;
 else raise exception 'INVALID_ACTION'; end if;
 return public.reme_state();
end;
$$;

-- Operator-only functions: no browser grants. Never accept an "admin" flag from a client.
create function reme_private.suspend_account(v_account uuid, v_suspended boolean) returns void
language sql set search_path = '' as $$ update reme_private.accounts set suspended=v_suspended where id=v_account; $$;
create function reme_private.test_reset() returns void language sql set search_path = '' as $$
 update reme_private.settings set generation=generation+1 where singleton;
$$;
-- Public visibility changes immediately at month boundary, even if maintenance is delayed.
-- Private retention: 90 days; held reports remain. Confirm this policy before public launch.
create function reme_private.purge_expired() returns void language plpgsql set search_path = '' as $$
begin
 delete from reme_private.profiles where epoch<>reme_private.epoch() and created_at<now()-interval '90 days';
 delete from reme_private.reports where created_at<now()-interval '90 days' and not legal_hold;
end;
$$;
revoke all on all functions in schema reme_private from public, anon, authenticated;
revoke all on function public.reme_state() from public, anon;
revoke all on function public.reme_mutate(text,jsonb,text) from public, anon;
grant execute on function public.reme_state() to authenticated;
grant execute on function public.reme_mutate(text,jsonb,text) to authenticated;
commit;
