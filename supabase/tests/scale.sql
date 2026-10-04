-- Fills the database with many users and times the queries the app makes, as one of those
-- users. Run with `SCALE=1 ./run.sh` (after the access-rule checks). Defaults to 100,000 users
-- with 26 comments each (half a year at one a week), 20 friends and 30 likes; set `-v users=…`
-- to change. The target is ~1,000,000 users; times should grow with a user's own data and
-- friends, not with the user count.
\set ON_ERROR_STOP 1
\if :{?users} \else \set users 100000 \endif

\echo -- building :users users (allow ten minutes: the trigram indexes make profile inserts slow)
insert into auth.users (id) select gen_random_uuid() from generate_series(1, :users);
insert into profiles (id, username, display_name)
  select id, 'user_' || row_number() over (), 'User' from auth.users
  where id not in (select id from profiles);  -- the access-rule checks leave a couple behind

-- Everyone sends ~20 requests to random users, all accepted. (Duplicate pairs are skipped.)
create temp table people as select id, row_number() over () as n from profiles;
insert into friendships (requester, addressee, accepted)
  select a.id, b.id, true
  from (select id, 1 + floor(random() * :users)::int as m from people, generate_series(1, 20)) a
  join people b on b.n = a.m
  where a.id <> b.id
  on conflict do nothing;

-- 30 likes, 10 library items and 26 comments each. Verses are skewed so a few are very popular:
-- John 3:16 gets about 2% of everything, as it might in real use.
create temp table verses as
  select case when r < 0.02 then 'JHN' else (array['GEN','PSA','PRO','ISA','MAT','JHN','ROM','1CO','EPH','PHP','REV'])[1 + (r * 11)::int % 11] end as book,
         case when r < 0.02 then 3 else 1 + (random() * 20)::int end as chapter,
         case when r < 0.02 then 16 else 1 + (random() * 30)::int end as verse
  from (select random() as r from generate_series(1, 66 * :users)) s;
insert into collection_items (collection_id, book, chapter, verse)
  select c.id, v.book, v.chapter, v.verse
  from (select id, row_number() over () as n from collections where kind = 'likes') c
  join (select *, row_number() over () as n from verses) v on (v.n - 1) / 30 + 1 = c.n
  where v.n <= 30 * :users
  on conflict do nothing;
insert into collection_items (collection_id, book, chapter, verse)
  select c.id, v.book, v.chapter, v.verse
  from (select id, row_number() over () as n from collections where kind = 'library') c
  join (select *, row_number() over () - 30 * :users as n from verses offset 30 * :users) v on (v.n - 1) / 10 + 1 = c.n
  where v.n <= 10 * :users
  on conflict do nothing;
insert into comments (user_id, book, chapter, verse, body)
  select p.id, v.book, v.chapter, v.verse, 'A thought on this verse'
  from (select id, row_number() over () as n from profiles) p
  join (select *, row_number() over () - 40 * :users as n from verses offset 40 * :users) v on (v.n - 1) / 26 + 1 = p.n;
analyze;

\echo -- rows
select 'friendships' as t, count(*) from friendships union all
select 'collection_items', count(*) from collection_items union all
select 'comments', count(*) from comments union all
select 'comments on John 3:16', count(*) from comments where (book, chapter, verse) = ('JHN', 3, 16);

-- Sign in as a user with a full set of friends.
select set_config('request.jwt.claim.sub', (select requester::text from friendships group by 1 order by count(*) desc limit 1), false) as me \gset
select friend_ids() as friend limit 1 \gset
select id as friend_library from collections where user_id = :'friend' and kind = 'library' \gset
set role authenticated;

\echo -- comments on John 3:16 by me and my friends, filtered by user as the app does
explain (analyze, costs off, timing off) select * from comments
  where (book, chapter, verse) = ('JHN', 3, 16)
    and user_id in (select friend_ids() union select (select auth.uid()));
\echo -- the same without the user filter: RLS alone has to read every comment on the verse
explain (analyze, costs off, timing off) select * from comments where (book, chapter, verse) = ('JHN', 3, 16);
\echo -- all my comments
explain (analyze, costs off, timing off) select * from comments where user_id = (select auth.uid());
\echo -- my collections
explain (analyze, costs off, timing off) select * from collections where user_id = (select auth.uid());
\echo -- a page of my Likes
explain (analyze, costs off, timing off) select * from collection_items
  where collection_id = (select id from collections where user_id = (select auth.uid()) and kind = 'likes')
  order by added_at desc limit 1000;
\echo -- the Library of a friend
explain (analyze, costs off, timing off) select * from collection_items where collection_id = :'friend_library';
\echo -- my friendships, with the other profile
explain (analyze, costs off, timing off) select f.*, p.username, p.display_name from friendships f
  join profiles p on p.id = case when f.requester = (select auth.uid()) then f.addressee else f.requester end;
\echo -- a profile by username
explain (analyze, costs off, timing off) select * from profiles where username = 'user_777';
\echo -- people search: a term matching a few hundred, one matching everyone, one matching nobody
explain (analyze, costs off, timing off) select * from search_profiles('r_777');
explain (analyze, costs off, timing off) select * from search_profiles('use');
explain (analyze, costs off, timing off) select * from search_profiles('xqzv');
\echo -- writes: a like and a comment
explain (analyze, costs off, timing off) insert into collection_items (collection_id, book, chapter, verse)
  select id, 'GEN', 50, 20 from collections where user_id = (select auth.uid()) and kind = 'likes';
explain (analyze, costs off, timing off) insert into comments (book, chapter, verse, body) values ('GEN', 50, 20, 'x');
