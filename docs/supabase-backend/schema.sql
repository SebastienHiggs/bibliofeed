-- Bibliofeed: the whole backend. Run once on a fresh Supabase project.

-- ---------- tables ----------

create table profiles (
  id           uuid primary key default auth.uid() references auth.users on delete cascade,
  username     text unique not null
               check (username ~ '^[a-z0-9_]{3,20}$')
               check (username not in (
                 -- Bible author handles (web/js/books.js) and app routes.
                 'moses','joshua','samuel','nathan_and_gad','jeremiah','ezra','nehemiah','mordecai',
                 'unknown','david','sons_of_korah','asaph','solomon','ethan','isaiah','ezekiel',
                 'daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk',
                 'zephaniah','haggai','zechariah','malachi','matthew','mark','luke','john','paul',
                 'james','peter','jude','me','search','signin','admin','bibliofeed')),
  display_name text not null check (length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);

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
-- Everyone has exactly one of each built-in collection.
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
create index comments_verse on comments (book, chapter, verse);
create index comments_user on comments (user_id);

-- ---------- functions ----------

-- Is `other` an accepted friend of the signed-in user? Only ever answers about
-- the caller, so it can't be used to probe other people's friendships.
create function is_friend(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships
    where accepted
      and ((requester = auth.uid() and addressee = other)
        or (requester = other and addressee = auth.uid())))
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

revoke execute on function is_friend, create_builtin_collections, delete_my_account from public, anon;
revoke execute on function create_builtin_collections from authenticated;

-- ---------- access rules ----------
-- Signed-out visitors (anon) get nothing: the app doesn't call Supabase without an account.

revoke all on profiles, friendships, collections, collection_items, comments from anon;
revoke update on profiles, friendships, collections, collection_items, comments from authenticated;
grant update (username, display_name) on profiles to authenticated;
grant update (accepted) on friendships to authenticated;
grant update (name) on collections to authenticated;

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table comments enable row level security;

-- Profiles: any signed-in user can see usernames and display names; you edit your own.
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "create own profile" on profiles for insert to authenticated with check (id = auth.uid());
create policy "edit own profile" on profiles for update to authenticated using (id = auth.uid());

-- Friendships: only the two people involved see them. You send requests as yourself,
-- only the person asked can accept, and either side can cancel or unfriend.
create policy "see own friendships" on friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "send request" on friendships for insert to authenticated
  with check (requester = auth.uid() and not accepted);
create policy "accept request" on friendships for update to authenticated
  using (addressee = auth.uid()) with check (accepted);
create policy "remove friendship" on friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- Collections: yours, plus your friends' libraries. Built-in ones can't be renamed or deleted.
create policy "see collections" on collections for select to authenticated
  using (user_id = auth.uid() or (kind = 'library' and is_friend(user_id)));
create policy "create collection" on collections for insert to authenticated
  with check (user_id = auth.uid() and kind = 'custom');
create policy "rename collection" on collections for update to authenticated
  using (user_id = auth.uid() and kind = 'custom');
create policy "delete collection" on collections for delete to authenticated
  using (user_id = auth.uid() and kind = 'custom');

-- Items: visible when their collection is visible; changed only in your own collections.
create policy "see items" on collection_items for select to authenticated
  using (collection_id in (select id from collections));
create policy "add item" on collection_items for insert to authenticated
  with check (collection_id in (select id from collections where user_id = auth.uid()));
create policy "remove item" on collection_items for delete to authenticated
  using (collection_id in (select id from collections where user_id = auth.uid()));

-- Comments: you and your friends see them; you add and delete your own (no editing).
create policy "see comments" on comments for select to authenticated
  using (user_id = auth.uid() or is_friend(user_id));
create policy "add comment" on comments for insert to authenticated
  with check (user_id = auth.uid());
create policy "delete comment" on comments for delete to authenticated
  using (user_id = auth.uid());
