-- The few pieces of Supabase that schema.sql relies on, so it can be tested on plain Postgres.
-- On a real Supabase project these already exist; don't run this file there.
do $$ begin
  create role anon nologin;
  create role authenticated nologin;
exception when duplicate_object then null; end $$;

create schema auth;
create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
-- Supabase reads the user id from the request's JWT; the tests set it with set_config.
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Supabase's default grants: both API roles can reach everything in public, and RLS decides.
grant usage on schema auth, extensions to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
