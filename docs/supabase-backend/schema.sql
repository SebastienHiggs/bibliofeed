-- Bibliofeed: the whole backend. Becomes the first file in supabase/migrations/.

-- ---------- tables ----------

-- Trigram matching, for the people search. Supabase keeps extensions in their own schema.
create extension if not exists pg_trgm with schema extensions;

create table profiles (
  id           uuid primary key default auth.uid() references auth.users on delete cascade,
  username     text unique not null
               check (username ~ '^[a-z0-9_]{3,20}$')
               -- App and system names only. Bible authors live at #/u/<handle>, users at #/@<username>,
               -- so a user may be @john; the two routes can't be confused.
               check (username not in ('me', 'search', 'signin', 'settings', 'admin', 'bibliofeed')),
  display_name text not null check (length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);
-- For search_profiles(): GiST, because it can return the nearest 20 names and stop.
create index profiles_username_search     on profiles using gist (username extensions.gist_trgm_ops);
create index profiles_display_name_search on profiles using gist (display_name extensions.gist_trgm_ops);

create table friendships (
  requester  uuid not null default auth.uid() references profiles on delete cascade,
  addressee  uuid not null references profiles on delete cascade,
  accepted   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- One row per pair, whichever way round the request went.
create unique index friendships_pair on friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee on friendships (addressee);

create table collections (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  kind    text not null default 'custom' check (kind in ('likes', 'saved', 'library', 'custom')),
  name    text not null check (length(name) between 1 and 40)
);
-- Everyone has exactly one of each built-in collection. Also serves "X's library" lookups.
create unique index collections_builtin on collections (user_id, kind) where kind <> 'custom';
create index collections_user on collections (user_id);

create table collection_items (
  collection_id uuid not null references collections on delete cascade,
  book     text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter  int  not null check (chapter > 0),
  verse    int  not null check (verse > 0),
  added_at timestamptz not null default now(),
  primary key (collection_id, book, chapter, verse)
);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references profiles on delete cascade,
  book       text not null check (book ~ '^[1-3A-Z]{3}$'),
  chapter    int  not null check (chapter > 0),
  verse      int  not null check (verse > 0),
  body       text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
-- The one index comments need. The app always asks "comments by these people (me and my
-- friends) on this verse" or "all my comments", and both are prefix lookups on it.
create index comments_user_verse on comments (user_id, book, chapter, verse);

-- ---------- functions ----------

-- The signed-in user's accepted friends. Runs as the caller, so it reads only the
-- friendship rows the caller may see anyway. Policies use it as `x in (select friend_ids())`,
-- which Postgres evaluates once per statement, not once per row.
create function friend_ids() returns setof uuid
language sql stable set search_path = '' as $$
  select case when requester = (select auth.uid()) then addressee else requester end
  from public.friendships
  where accepted and (select auth.uid()) in (requester, addressee)
$$;

-- People search: the 20 profiles whose username or display name best matches `q` as a word
-- (pg_trgm word similarity, so "seb" finds "Sebastien Higgs" and small typos are forgiven).
-- Each half is a nearest-neighbour scan of its index that stops after 20 rows, so the cost
-- doesn't depend on how many people match or on the size of the table. Two characters minimum.
create function search_profiles(q text) returns setof profiles
language sql stable set search_path = '' as $$
  select p.* from (
    (select * from public.profiles where q operator(extensions.<%) username
       order by q operator(extensions.<<->) username limit 20)
    union
    (select * from public.profiles where q operator(extensions.<%) display_name
       order by q operator(extensions.<<->) display_name limit 20)
  ) p
  order by least(q operator(extensions.<<->) p.username, q operator(extensions.<<->) p.display_name), p.username
  limit 20
$$;

-- Every new profile gets its built-in collections.
create function create_builtin_collections() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collections (user_id, kind, name) values
    (new.id, 'likes', 'Likes'), (new.id, 'saved', 'Saved'), (new.id, 'library', 'Library');
  return new;
end $$;
create trigger profiles_builtin_collections after insert on profiles
  for each row execute function create_builtin_collections();

-- Delete the signed-in user's account. Cascades to everything they own.
create function delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid()
$$;

-- ---------- privileges ----------
-- Spelled out in full so the schema doesn't depend on a project's default grants.
-- Signed-out visitors (anon) get nothing: the app doesn't call Supabase without an account.

revoke all on profiles, friendships, collections, collection_items, comments from public, anon, authenticated;
revoke all on function friend_ids, search_profiles, create_builtin_collections, delete_my_account from public, anon, authenticated;

grant select, insert         on profiles to authenticated;   -- deleted only via delete_my_account()
grant update (username, display_name) on profiles to authenticated;
grant select, insert, delete on friendships to authenticated;
grant update (accepted)      on friendships to authenticated;
grant select, insert, delete on collections to authenticated;
grant update (name)          on collections to authenticated;
grant select, insert, delete on collection_items, comments to authenticated;  -- no update: nothing to edit
grant execute on function friend_ids, search_profiles, delete_my_account to authenticated;

-- ---------- access rules ----------
-- `(select auth.uid())` rather than `auth.uid()`: Postgres then reads the user id once per
-- statement instead of once per row, as Supabase's RLS guidance recommends.

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table comments enable row level security;

-- Profiles: any signed-in user can see usernames and display names; you edit your own.
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "create own profile" on profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "edit own profile" on profiles for update to authenticated using (id = (select auth.uid()));

-- Friendships: only the two people involved see them. You send requests as yourself,
-- only the person asked can accept, and either side can cancel or unfriend.
create policy "see own friendships" on friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
create policy "send request" on friendships for insert to authenticated
  with check (requester = (select auth.uid()) and not accepted);
create policy "accept request" on friendships for update to authenticated
  using (addressee = (select auth.uid())) with check (accepted);
create policy "remove friendship" on friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));

-- Collections: yours, plus your friends' libraries. Built-in ones can't be renamed or deleted.
create policy "see collections" on collections for select to authenticated
  using (user_id = (select auth.uid()) or (kind = 'library' and user_id in (select friend_ids())));
create policy "create collection" on collections for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'custom');
create policy "rename collection" on collections for update to authenticated
  using (user_id = (select auth.uid()) and kind = 'custom');
create policy "delete collection" on collections for delete to authenticated
  using (user_id = (select auth.uid()) and kind = 'custom');

-- Items: visible when their collection is visible; changed only in your own collections.
-- The correlated `exists` looks up only the row's own collection. (`collection_id in (select id
-- from collections)` would make Postgres test every library in the system on each query.)
create policy "see items" on collection_items for select to authenticated
  using (exists (select 1 from collections c where c.id = collection_items.collection_id));
create policy "add item" on collection_items for insert to authenticated
  with check (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = (select auth.uid())));
create policy "remove item" on collection_items for delete to authenticated
  using (exists (select 1 from collections c where c.id = collection_items.collection_id and c.user_id = (select auth.uid())));

-- Comments: you and your friends see them; you add and delete your own (no editing).
create policy "see comments" on comments for select to authenticated
  using (user_id = (select auth.uid()) or user_id in (select friend_ids()));
create policy "add comment" on comments for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "delete comment" on comments for delete to authenticated
  using (user_id = (select auth.uid()));
