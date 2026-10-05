-- Saved is gone: the heart does its job now (tap to like, hold to put the verse
-- in a collection), so every account has two built-in collections, Likes and
-- Library, plus its own. A Saved collection with verses in it becomes an
-- ordinary collection called "Saved", so nothing is lost; empty ones go.

delete from collections
  where kind = 'saved' and not exists (select 1 from collection_items i where i.collection_id = collections.id);
update collections set kind = 'custom' where kind = 'saved';

alter table collections drop constraint collections_kind_check;
alter table collections add constraint collections_kind_check check (kind in ('likes', 'library', 'custom'));

create or replace function create_builtin_collections() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collections (user_id, kind, name) values
    (new.id, 'likes', 'Likes'), (new.id, 'library', 'Library');
  return new;
end $$;
