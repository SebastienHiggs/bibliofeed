-- A fuller list of usernames nobody may take: the app's routes and words, names
-- people would assume belong to the site or its staff, technical words that
-- confuse URLs and email, and names whose use would be impersonation or in
-- poor taste. Bible authors are deliberately not here (a real John may be
-- @john; authors live at #/u/<handle>, people at #/@<username>).
-- Replaces the short list from the first migration.

alter table profiles drop constraint profiles_username_check1;

alter table profiles add constraint profiles_username_reserved check (username not in (
  -- the app's routes and screens
  'me', 'you', 'feed', 'home', 'search', 'explore', 'discover', 'signin', 'sign_in', 'signup', 'sign_up',
  'signout', 'sign_out', 'login', 'log_in', 'logout', 'log_out', 'register', 'verify', 'reset', 'password',
  'account', 'accounts', 'settings', 'profile', 'profiles', 'user', 'users', 'username', 'friend', 'friends',
  'library', 'libraries', 'collection', 'collections', 'saved', 'saves', 'likes', 'liked', 'comment',
  'comments', 'post', 'posts', 'verse', 'verses', 'chapter', 'chapters', 'book', 'books', 'study', 'studies',
  'notifications', 'messages', 'inbox', 'import', 'export', 'share', 'new', 'edit', 'delete', 'create',
  'about', 'contributing', 'contribute', 'privacy', 'terms', 'legal', 'help', 'support', 'contact', 'faq',
  'blog', 'news', 'status', 'docs', 'download', 'downloads', 'app', 'apps', 'mobile', 'ios', 'android',
  -- the site, its people and roles
  'bibliofeed', 'biblio_feed', 'bibliofeedapp', 'bibliofeed_app', 'bibliofeedofficial', 'bibliofeed_official',
  'bibliofeedteam', 'bibliofeed_team', 'bibliofeedhelp', 'bibliofeed_help', 'bibliofeedsupport',
  'bibliofeed_support', 'bibliofeednews', 'bibliofeedbot', 'admin', 'admins', 'administrator', 'administrators',
  'mod', 'mods', 'moderator', 'moderators', 'staff', 'team', 'official', 'owner', 'founder', 'editor',
  'editors', 'bot', 'bots', 'robot', 'service', 'services', 'system', 'sys', 'root', 'superuser', 'operator',
  -- technical words that confuse links, email and code
  'www', 'web', 'api', 'auth', 'oauth', 'callback', 'static', 'assets', 'vendor', 'public', 'private', 'data',
  'dist', 'images', 'img', 'css', 'js', 'json', 'xml', 'rss', 'sitemap', 'robots', 'mail', 'email', 'smtp',
  'info', 'hello', 'noreply', 'no_reply', 'postmaster', 'webmaster', 'hostmaster', 'abuse', 'security',
  'dev', 'devs', 'developer', 'developers', 'test', 'tests', 'testing', 'tester', 'demo', 'example', 'sample',
  'null', 'undefined', 'none', 'nil', 'void', 'true', 'false', 'anonymous', 'anon', 'guest', 'guests',
  'unknown', 'nobody', 'everyone', 'everybody', 'someone', 'anyone', 'all', 'default', 'error', '404',
  -- impersonation, or in poor taste in a Bible app
  'god', 'lord', 'jesus', 'jesuschrist', 'jesus_christ', 'christ', 'messiah', 'yahweh', 'jehovah', 'holyspirit',
  'holy_spirit', 'holyghost', 'holy_ghost', 'thelord', 'the_lord', 'thebible', 'the_bible', 'bible', 'bibles',
  'scripture', 'scriptures', 'gospel', 'church', 'thechurch', 'pastor', 'satan', 'devil', 'lucifer', 'antichrist',
  -- the translation and the services behind the site
  'bsb', 'berean', 'bereanbible', 'supabase', 'cloudflare', 'resend', 'github'
));
