-- Persistent PRIVATE login aliases. Passwords remain exclusively in Supabase Auth.
begin;
create table reme_private.login_identities (
  login_id text primary key check (login_id ~ '^[a-z][a-z0-9_-]{3,23}$'),
  auth_email text not null unique default (gen_random_uuid()::text || '@login.reme.invalid'),
  created_at timestamptz not null default now()
);
create table reme_private.auth_attempts (
  bucket text primary key,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  attempts integer not null
);
create index auth_attempts_expiry on reme_private.auth_attempts(expires_at);
alter table reme_private.login_identities enable row level security;
alter table reme_private.auth_attempts enable row level security;
revoke all on reme_private.login_identities, reme_private.auth_attempts from public, anon, authenticated;

-- Only the server can resolve an alias. Never expose this mapping to browser roles.
create function public.reme_login_identity(login_id text, create_if_missing boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  if login_id is null or login_id !~ '^[a-z][a-z0-9_-]{3,23}$' or create_if_missing is null then
    raise exception 'INVALID_INPUT';
  end if;
  if create_if_missing then
    insert into reme_private.login_identities(login_id) values (login_id) on conflict do nothing;
  end if;
  select i.auth_email into v_email from reme_private.login_identities i where i.login_id = reme_login_identity.login_id;
  return v_email;
end;
$$;

-- Return false instead of raising: denied attempts must still be committed.
create function reme_private.consume_auth_bucket(v_key text, v_limit integer, v_seconds integer)
returns boolean language plpgsql set search_path = '' as $$
declare v_count integer;
begin
  insert into reme_private.auth_attempts as a values
    (v_key, statement_timestamp(), statement_timestamp() + make_interval(secs => v_seconds), 1)
  on conflict (bucket) do update set
    started_at = case when a.expires_at <= statement_timestamp() then statement_timestamp() else a.started_at end,
    expires_at = case when a.expires_at <= statement_timestamp() then statement_timestamp() + make_interval(secs => v_seconds) else a.expires_at end,
    attempts = case when a.expires_at <= statement_timestamp() then 1 else least(a.attempts + 1, v_limit + 1) end
  returning attempts into v_count;
  return v_count <= v_limit;
end;
$$;
create function public.reme_auth_attempt(client_hash text, login_hash text, registering boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if client_hash is null or login_hash is null or registering is null
     or client_hash !~ '^[a-f0-9]{64}$' or login_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_INPUT';
  end if;
  delete from reme_private.auth_attempts where expires_at < statement_timestamp() - interval '1 day';
  -- Global limits cannot be bypassed by spoofing forwarding headers / rotating IDs.
  if not reme_private.consume_auth_bucket('global:minute', 300, 60) then return false; end if;
  if not reme_private.consume_auth_bucket('client:' || client_hash, 30, 60) then return false; end if;
  if not reme_private.consume_auth_bucket('login:' || login_hash, 15, 900) then return false; end if;
  if registering then
    if not reme_private.consume_auth_bucket('signup:global', 30, 3600) then return false; end if;
    if not reme_private.consume_auth_bucket('signup:client:' || client_hash, 5, 3600) then return false; end if;
  end if;
  return true;
end;
$$;
revoke all on function reme_private.consume_auth_bucket(text, integer, integer) from public, anon, authenticated;
revoke all on function public.reme_login_identity(text, boolean), public.reme_auth_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.reme_login_identity(text, boolean), public.reme_auth_attempt(text, text, boolean) to service_role;
commit;
