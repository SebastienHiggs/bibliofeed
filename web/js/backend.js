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

// Emails a 6-digit code; creates the account if the email is new.
export async function requestCode(email) {
  const c = await client();
  unwrap(await c.auth.signInWithOtp({ email }));
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

// Deletes the account and everything it owns (the database cascades).
export async function deleteAccount() {
  const c = await client();
  unwrap(await c.rpc('delete_my_account'));
  await c.auth.signOut({ scope: 'local' }); // the account is gone, so only this browser's session needs clearing
  me = null;
  flag.set(false);
  notify();
}
