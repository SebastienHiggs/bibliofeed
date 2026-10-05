// The one module that talks to Supabase: loading the client, signing in and
// out, and who the signed-in user is. Signed out, nothing here loads or makes
// a request. The data model is described in docs/supabase-backend/README.md.
import { SUPABASE_KEY, SUPABASE_URL } from './config.js';

export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Set while someone is signed in on this browser, so the app knows at startup
// whether to load the client at all (without depending on how it stores its session).
const FLAG = 'bibliofeed:signedIn';
const flag = {
  get: () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } },
  set: (on) => { try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch { /* storage unavailable */ } },
};

// The signed-in user: { id, profile } where profile is { username, displayName }
// or null until they've chosen one. Null when signed out.
export let me = null;
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn(me));
export const signedIn = () => Boolean(me?.profile);

// supabase-js is bundled with the site as vendor/supabase.js (a UMD build that
// defines window.supabase), so no third-party CDN sees visitors' requests.
function loadLibrary() {
  if (window.supabase) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase.js';
    s.onload = () => resolve(window.supabase);
    s.onerror = () => reject(new Error('Couldn’t load the sign-in library'));
    document.head.append(s);
  });
}

let clientPromise = null;
export function client() {
  if (!configured) return Promise.reject(new Error('No backend is configured'));
  return (clientPromise ??= loadLibrary().then((lib) => {
    const c = lib.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { detectSessionInUrl: false } });
    // Signing out in another tab signs this one out too.
    c.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && me) {
        me = null;
        flag.set(false);
        notify();
      }
    });
    return c;
  }));
}

// supabase-js reports failures as { data, error }; turn them into exceptions.
const unwrap = ({ data, error }) => {
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status: error.status });
  return data;
};

async function loadMe(userId) {
  const c = await client();
  const row = unwrap(await c.from('profiles').select('username, display_name').eq('id', userId).maybeSingle());
  me = { id: userId, profile: row && { username: row.username, displayName: row.display_name } };
  flag.set(true);
  notify();
}

// Picks up an existing session at startup. Resolves once `me` is known.
export const ready = (async () => {
  if (!configured || !flag.get()) return;
  try {
    const c = await client();
    const { session } = unwrap(await c.auth.getSession());
    if (session) await loadMe(session.user.id);
    else flag.set(false);
  } catch (err) {
    console.error(err);
  }
})();

// ---------- signing in ----------

// Emails a 6-digit code; creates the account if the email is new. The captcha
// token comes from js/captcha.js (undefined when the bot check is off).
export async function requestCode(email, captchaToken) {
  const c = await client();
  unwrap(await c.auth.signInWithOtp({ email, options: { captchaToken } }));
}

export async function verifyCode(email, token) {
  const c = await client();
  const { session } = unwrap(await c.auth.verifyOtp({ email, token, type: 'email' }));
  await loadMe(session.user.id);
}

// First sign-in: choose a username and display name. The database creates the
// built-in collections. Throws with .code '23505' if the username is taken and
// '23514' if it's not allowed.
export async function createProfile(username, displayName) {
  const c = await client();
  unwrap(await c.from('profiles').insert({ username, display_name: displayName }));
  await loadMe(me.id);
}

export async function signOut() {
  const c = await client();
  await c.auth.signOut();
  me = null;
  flag.set(false);
  notify();
}

// ---------- your activity ----------
// activity.js keeps the signed-in user's collections and comments in memory and
// calls these to load them and to mirror each change. Shapes match activity.js:
// a reference is { book, chapter, verse } and `at` is milliseconds.

const PAGE = 1000; // the API returns at most this many rows per request, silently
async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = unwrap(await query().range(from, from + PAGE - 1));
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

export async function fetchMyActivity() {
  const c = await client();
  const collections = unwrap(await c.from('collections').select('id, kind, name').eq('user_id', me.id).order('id'));
  const ids = collections.map((x) => x.id);
  const [items, comments] = await Promise.all([
    allRows(() => c.from('collection_items').select('collection_id, book, chapter, verse, added_at').in('collection_id', ids)
      .order('collection_id').order('book').order('chapter').order('verse')),
    allRows(() => c.from('comments').select('id, book, chapter, verse, body, created_at').eq('user_id', me.id).order('created_at').order('id')),
  ]);
  const byId = new Map(collections.map((x) => [x.id, { ...x, items: [] }]));
  for (const i of items) byId.get(i.collection_id)?.items.push({ book: i.book, chapter: i.chapter, verse: i.verse, at: Date.parse(i.added_at) });
  return {
    collections: [...byId.values()],
    comments: comments.map((x) => ({ id: x.id, book: x.book, chapter: x.chapter, verse: x.verse, comment: x.body, at: Date.parse(x.created_at) })),
    friends: await fetchFriendships(c),
  };
}

// Everyone you have a friendship row with (the rules only show your own), as
// { id, username, displayName, accepted, incoming }. `incoming` means they asked you.
async function fetchFriendships(c) {
  const rows = unwrap(await c.from('friendships').select('requester, addressee, accepted'));
  if (!rows.length) return [];
  const others = rows.map((r) => (r.requester === me.id ? r.addressee : r.requester));
  const profiles = unwrap(await c.from('profiles').select('id, username, display_name').in('id', others));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((r) => {
    const other = byId.get(r.requester === me.id ? r.addressee : r.requester);
    return other && { id: other.id, username: other.username, displayName: other.display_name, accepted: r.accepted, incoming: r.addressee === me.id };
  }).filter(Boolean);
}

// Comments by these people on one chapter. Always called with explicit ids
// (the signed-in user's friends) so the cost follows the friend count, not the
// chapter's popularity; see docs/supabase-backend/README.md.
export async function commentsBy(userIds, bookId, chapter) {
  if (!userIds.length) return [];
  const c = await client();
  const rows = unwrap(await c.from('comments').select('id, user_id, verse, body, created_at')
    .in('user_id', userIds).eq('book', bookId).eq('chapter', chapter).order('created_at').limit(PAGE));
  return rows.map((r) => ({ id: r.id, book: bookId, chapter, verse: r.verse, comment: r.body, at: Date.parse(r.created_at), userId: r.user_id }));
}

const iso = (ms) => new Date(ms).toISOString();
export const activity = {
  addItem: async (collectionId, { book, chapter, verse, at }) =>
    unwrap(await (await client()).from('collection_items').insert({ collection_id: collectionId, book, chapter, verse, added_at: iso(at) })),
  removeItem: async (collectionId, { book, chapter, verse }) =>
    unwrap(await (await client()).from('collection_items').delete().match({ collection_id: collectionId, book, chapter, verse })),
  addComment: async ({ id, book, chapter, verse, comment, at }) =>
    unwrap(await (await client()).from('comments').insert({ id, book, chapter, verse, body: comment, created_at: iso(at) })),
  removeComment: async (id) => unwrap(await (await client()).from('comments').delete().eq('id', id)),
  // Bulk, for importing a browser's data. Items already in a collection are skipped, so running twice is harmless.
  addItems: async (rows) => unwrap(await (await client()).from('collection_items')
    .upsert(rows.map(({ collectionId, book, chapter, verse, at }) => ({ collection_id: collectionId, book, chapter, verse, added_at: iso(at) })),
      { onConflict: 'collection_id,book,chapter,verse', ignoreDuplicates: true })),
  addComments: async (rows) => unwrap(await (await client()).from('comments')
    .insert(rows.map(({ id, book, chapter, verse, comment, at }) => ({ id, book, chapter, verse, body: comment, created_at: iso(at) })))),
  createCollection: async ({ id, name }) => unwrap(await (await client()).from('collections').insert({ id, name })),
  renameCollection: async (id, name) => unwrap(await (await client()).from('collections').update({ name }).eq('id', id)),
  deleteCollection: async (id) => unwrap(await (await client()).from('collections').delete().eq('id', id)),
};

// ---------- other people ----------

export async function profileByUsername(username) {
  const c = await client();
  const row = unwrap(await c.from('profiles').select('id, username, display_name').eq('username', username).maybeSingle());
  return row && { id: row.id, username: row.username, displayName: row.display_name };
}

// People whose username or display name matches `q` (the database's search_profiles(), see the plan).
export async function searchProfiles(q) {
  const c = await client();
  const rows = unwrap(await c.rpc('search_profiles', { q }));
  return rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name }));
}

// A friend's Library items, newest first. The rules only return a friend's.
export async function libraryOf(userId) {
  const c = await client();
  const lib = unwrap(await c.from('collections').select('id').eq('user_id', userId).eq('kind', 'library').maybeSingle());
  if (!lib) return [];
  const rows = await allRows(() => c.from('collection_items').select('book, chapter, verse, added_at').eq('collection_id', lib.id)
    .order('added_at', { ascending: false }).order('book').order('chapter').order('verse'));
  return rows.map((r) => ({ book: r.book, chapter: r.chapter, verse: r.verse, at: Date.parse(r.added_at) }));
}

// The friendship row is (requester, addressee); `incoming` means they asked me.
export const friendships = {
  request: async (addressee) => unwrap(await (await client()).from('friendships').insert({ addressee })),
  accept: async (requester) => unwrap(await (await client()).from('friendships').update({ accepted: true }).match({ requester, addressee: me.id })),
  remove: async (other, incoming) =>
    unwrap(await (await client()).from('friendships').delete().match(incoming ? { requester: other, addressee: me.id } : { requester: me.id, addressee: other })),
};

// Deletes the account and everything it owns (the database cascades).
export async function deleteAccount() {
  const c = await client();
  unwrap(await c.rpc('delete_my_account'));
  await c.auth.signOut({ scope: 'local' }); // the account is gone, so only this browser's session needs clearing
  me = null;
  flag.set(false);
  notify();
}
