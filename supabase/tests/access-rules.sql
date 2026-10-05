-- Checks the access rules in ../schema.sql. Run with ./run.sh.
-- Each check raises an error (and stops the run) if a rule doesn't hold.
\set ON_ERROR_STOP 1
\o /dev/null

create function t_as(u text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u, false) $$;
-- True if running the statement raises an error.
create function t_fails(stmt text) returns boolean language plpgsql as $$
begin execute stmt; return false; exception when others then return true; end $$;
-- Number of rows the statement touched (for updates/deletes that RLS silently skips).
create function t_rows(stmt text) returns int language plpgsql as $$
declare n int; begin execute stmt; get diagnostics n = row_count; return n; end $$;
create function t_check(label text, ok boolean) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; raise notice 'ok: %', label; end $$;
grant execute on function t_as, t_fails, t_rows, t_check to anon, authenticated;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c');
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'

set role authenticated;

-- Profiles
select t_as(:'A');
select t_check('reserved usernames are refused', t_fails($$insert into profiles (username, display_name) values ('admin', 'P')$$)
  and t_fails($$insert into profiles (username, display_name) values ('support', 'S')$$)
  and t_fails($$insert into profiles (username, display_name) values ('jesus', 'J')$$));
select t_check('Bible author names are refused', t_fails($$insert into profiles (username, display_name) values ('paul', 'Paul')$$)
  and t_fails($$insert into profiles (username, display_name) values ('sons_of_korah', 'K')$$));
select t_check('uppercase usernames are refused', t_fails($$insert into profiles (username, display_name) values ('Alice', 'A')$$));
select t_check('cannot create a profile for someone else',
  t_fails(format($$insert into profiles (id, username, display_name) values (%L, 'bob', 'B')$$, :'B')));
insert into profiles (username, display_name) values ('alice', 'Alice');
select t_as(:'B'); insert into profiles (username, display_name) values ('bob', 'Bob');
select t_as(:'C'); insert into profiles (username, display_name) values ('carol', 'Carol');
select t_check('cannot edit someone else''s profile', t_rows($$update profiles set display_name = 'x' where username = 'alice'$$) = 0);
select t_check('cannot delete a profile directly', t_fails($$delete from profiles where username = 'carol'$$));
select t_check('search finds people by username and by display name',
  (select array_agg(username order by username) from search_profiles('car')) = '{carol}'
  and (select array_agg(username order by username) from search_profiles('Ali')) = '{alice}'
  and (select count(*) from search_profiles('zzzz')) = 0);

-- Collections
select t_as(:'A');
select t_check('new profile gets Likes and Library',
  (select array_agg(kind order by kind) from collections) = '{library,likes}');
select t_check('cannot create a second Likes', t_fails($$insert into collections (kind, name) values ('likes', 'x')$$));
insert into collections (name) values ('Psalms I love');
select t_check('built-in collections cannot be renamed', t_rows($$update collections set name = 'x' where kind = 'likes'$$) = 0);
select t_check('built-in collections cannot be deleted', t_rows($$delete from collections where kind = 'library'$$) = 0);
select t_check('custom collections can be renamed', t_rows($$update collections set name = 'Psalms' where kind = 'custom'$$) = 1);
select t_check('collection kind cannot be changed', t_fails($$update collections set kind = 'library' where kind = 'custom'$$));

-- Friendships
select t_check('cannot send an already-accepted request',
  t_fails(format($$insert into friendships (addressee, accepted) values (%L, true)$$, :'C')));
select t_check('cannot send a request as someone else',
  t_fails(format($$insert into friendships (requester, addressee) values (%L, %L)$$, :'B', :'C')));
insert into friendships (addressee) values (:'B');
select t_check('requester cannot accept their own request', t_rows('update friendships set accepted = true') = 0);
select t_check('a pending request is not a friend', (select count(*) from friend_ids()) = 0);
select t_as(:'C');
select t_check('others cannot see a friendship', (select count(*) from friendships) = 0);
select t_as(:'B');
select t_check('a reverse request for the same pair is refused',
  t_fails(format($$insert into friendships (addressee) values (%L)$$, :'A')));
select t_check('cannot rewrite who a request is from', t_fails(format('update friendships set requester = %L', :'C')));
select t_check('addressee can accept', t_rows('update friendships set accepted = true') = 1);
select t_check('friend_ids sees it both ways', (select array_agg(f) from friend_ids() f) = array[:'A'::uuid]);
select t_as(:'A'); select t_check('friend_ids from the other side', (select array_agg(f) from friend_ids() f) = array[:'B'::uuid]);

-- Collection items and comments: A and B are friends, C is friends with no one.
select t_as(:'A');
insert into collection_items (collection_id, book, chapter, verse)
  select id, 'JHN', 3, 16 from collections where user_id = :'A' and kind in ('likes', 'library');
insert into comments (book, chapter, verse, body) values ('JHN', 3, 16, 'from A');
select t_check('bad book codes are refused',
  t_fails($$insert into comments (book, chapter, verse, body) values ('John', 3, 16, 'x')$$));
select t_check('cannot comment as someone else',
  t_fails(format($$insert into comments (user_id, book, chapter, verse, body) values (%L, 'JHN', 3, 16, 'x')$$, :'B')));
select t_as(:'C');
insert into comments (book, chapter, verse, body) values ('JHN', 3, 16, 'from C');

select t_as(:'B');
select t_check('friend sees only the Library collection',
  (select array_agg(kind) from collections where user_id = :'A') = '{library}');
select t_check('friend sees only Library items',
  (select count(*) from collection_items) = 1);
select t_check('friend sees friend''s comments, not strangers''',
  (select array_agg(body order by body) from comments) = '{"from A"}');
select t_check('cannot add to a friend''s Library',
  t_fails(format($$insert into collection_items (collection_id, book, chapter, verse)
    select id, 'GEN', 1, 1 from collections where user_id = %L and kind = 'library'$$, :'A')));
select t_check('cannot remove from a friend''s Library',
  t_rows(format($$delete from collection_items where collection_id in (select id from collections where user_id = %L)$$, :'A')) = 0);
select t_check('cannot rename a friend''s collection',
  t_rows(format($$update collections set name = 'x' where user_id = %L$$, :'A')) = 0);
select t_check('cannot delete a friend''s comment', t_rows($$delete from comments where body = 'from A'$$) = 0);
select t_check('comments cannot be edited', t_fails($$update comments set body = 'x'$$));

select t_as(:'C');
select t_check('stranger sees only their own comments', (select array_agg(body) from comments) = '{"from C"}');
select t_check('stranger sees none of A''s collections', (select count(*) from collections where user_id = :'A') = 0);
select t_check('stranger sees no items', (select count(*) from collection_items) = 0);

-- Signed-out visitors
reset role; set role anon;
select t_check('signed-out visitors cannot read profiles', t_fails('select * from profiles'));
select t_check('signed-out visitors cannot read comments', t_fails('select * from comments'));
select t_check('signed-out visitors cannot call friend_ids', t_fails('select friend_ids()'));
select t_check('signed-out visitors cannot search people', t_fails($$select search_profiles('a')$$));
select t_check('signed-out visitors cannot delete an account', t_fails('select delete_my_account()'));

-- Unfriending and deleting an account
reset role; set role authenticated;
select t_as(:'B');
select t_check('either side can unfriend', t_rows('delete from friendships') = 1);
select t_check('after unfriending, comments are hidden', (select count(*) from comments) = 0);
select t_as(:'A');
select delete_my_account();
reset role;
select t_check('deleting an account removes everything it owned',
  not exists (select 1 from profiles where id = :'A')
  and not exists (select 1 from collections where user_id = :'A')
  and not exists (select 1 from comments where user_id = :'A'));
\echo 'All checks passed.'
