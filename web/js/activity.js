// Your own activity: likes, saves, custom collections and comments.
//
// Two stores behind one synchronous interface. Signed out, it lives in this
// browser's localStorage. Signed in, it's your account: loaded into memory
// when the app starts, read from memory, and every change is applied here
// first, then sent to the backend (and undone here if that fails).
//
// Everything is a verse reference, { book: 'JHN', chapter: 3, verse: 16 },
// never the text: the app has the whole Bible and looks text up when needed.
import { BOOKS } from './books.js';
import * as backend from './backend.js';
import { toast } from './ui.js';

// Keeps the app's original name so existing saves, likes and comments are found.
const KEY = 'verse-feed:activity';
const bookById = new Map(BOOKS.map((b) => [b.id, b]));
export const newId = () => crypto.randomUUID();

// Likes is a collection like any other; everyone has it. (Accounts also have a
// Library, which exists to be seen by friends.)
const BUILTIN = [['likes', 'Likes']];
const empty = () => ({
  version: 3,
  collections: BUILTIN.map(([kind, name]) => ({ id: kind, kind, name, items: [] })),
  comments: [],
  friends: [], // signed in only: everyone with a friendship row, accepted or pending
  importedAt: null, // set once this browser's data has been added to an account
});

// Older data. Version 1 kept `liked` and `saved` maps with a copy of each
// verse's text, and a list of followed authors; version 2 had a built-in Saved
// collection beside Likes. Saved verses become an ordinary collection called
// "Saved" (dropped if there were none), and the references and comments carry over.
const refs = (map) => Object.values(map || {}).map(({ book, chapter, verse, at }) => ({ book, chapter, verse, at }));
function upgrade(data) {
  const v2 = data.version === 2 ? data : {
    collections: [{ id: 'likes', kind: 'likes', name: 'Likes', items: refs(data.liked) }, { id: 'saved', kind: 'saved', name: 'Saved', items: refs(data.saved) }],
    comments: (data.comments || []).map(({ id, book, chapter, verse, comment, at }) => ({ id, book, chapter, verse, comment, at })),
    importedAt: null,
  };
  const collections = (v2.collections || []).flatMap((c) => {
    if (c.kind !== 'saved') return [c];
    return c.items.length ? [{ ...c, id: newId(), kind: 'custom' }] : [];
  });
  return { ...empty(), ...v2, version: 3, collections };
}

function loadLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data) return empty();
    return data.version === 3 ? { ...empty(), ...data } : upgrade(data);
  } catch {
    return empty();
  }
}

let state = loadLocal();
let remote = null; // the signed-in user's id while their account is the store
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn());

// "JHN.3.16": how the rest of the app names a post.
export const postKey = (book, chapter, verse) => `${book.id}.${chapter}.${verse}`;
const refKey = ({ book, chapter, verse }) => `${book}.${chapter}.${verse}`;

// For fast isLiked checks while the feed renders.
let keys = new Map(); // collection id -> Set of keys
const reindex = () => { keys = new Map(state.collections.map((c) => [c.id, new Set(c.items.map(refKey))])); };
reindex();

function commit() {
  reindex();
  if (!remote) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }
  notify();
}

// Signed in: send the change to the account; if that fails, put things back.
// Changes go out one after another, in the order they were made, so a new
// collection always exists before the first verse saved into it arrives.
let sending = Promise.resolve();
function persist(send, undo) {
  if (!remote) return;
  sending = sending.then(send).catch((err) => {
    console.error(err);
    undo();
    commit();
    toast('That didn’t save. Check your connection and try again.');
  });
}

// ---------- which store ----------

async function syncStore() {
  const user = backend.signedIn() ? backend.me.id : null;
  if (user === remote) return;
  friendComments.clear();
  if (!user) {
    remote = null;
    state = loadLocal();
    commit();
    return;
  }
  remote = user;
  state = { ...empty(), collections: [] }; // nothing of this browser's shows while the account loads
  commit();
  try {
    const data = await backend.fetchMyActivity();
    if (remote !== user) return; // signed out meanwhile
    state = { ...empty(), ...data };
    commit();
  } catch (err) {
    console.error(err);
    toast('Couldn’t load your account. Pull to refresh or try again later.');
  }
}
backend.ready.then(syncStore);
backend.onChange(syncStore);
export const loaded = () => !remote || state.collections.length > 0;

// ---------- collections ----------

const find = (id) => state.collections.find((c) => c.id === id);
const byKind = (kind) => state.collections.find((c) => c.kind === kind);

export const collections = () => state.collections.map(({ id, kind, name, items }) => ({ id, kind, name, count: items.length }));
export const inCollection = (id, key) => keys.get(id)?.has(key) ?? false;
export const isLiked = (key) => inCollection(byKind('likes')?.id, key);

// `verse` may be a verse object ({ number, text }) or just the number.
export function setInCollection(id, book, chapter, verse, on) {
  const c = find(id);
  if (!c) return;
  const ref = { book: book.id, chapter, verse: verse.number ?? verse, at: Date.now() };
  const before = c.items;
  c.items = c.items.filter((i) => refKey(i) !== refKey(ref));
  if (on) c.items.push(ref);
  commit();
  persist(() => (on ? backend.activity.addItem(id, ref) : backend.activity.removeItem(id, ref)), () => { c.items = before; });
}
export const setLiked = (book, chapter, verse, on) => setInCollection(byKind('likes')?.id, book, chapter, verse, on);
// The Library exists only in accounts: it's the collection friends can see.
export const hasLibrary = () => Boolean(byKind('library'));
export const inLibrary = (key) => inCollection(byKind('library')?.id, key);
export const setInLibrary = (book, chapter, verse, on) => setInCollection(byKind('library')?.id, book, chapter, verse, on);

export function createCollection(name) {
  const c = { id: newId(), kind: 'custom', name, items: [] };
  state.collections.push(c);
  commit();
  persist(() => backend.activity.createCollection(c), () => { state.collections = state.collections.filter((x) => x !== c); });
  return c.id;
}
export function renameCollection(id, name) {
  const c = find(id);
  if (c?.kind !== 'custom') return;
  const before = c.name;
  c.name = name;
  commit();
  persist(() => backend.activity.renameCollection(id, name), () => { c.name = before; });
}
export function deleteCollection(id) {
  const c = find(id);
  if (c?.kind !== 'custom') return;
  const before = state.collections;
  state.collections = state.collections.filter((x) => x !== c);
  commit();
  persist(() => backend.activity.deleteCollection(id), () => { state.collections = before; });
}

// Items as the grids want them: { book (object), chapter, verse, at }, newest first.
const expand = (ref) => ({ ...ref, book: bookById.get(ref.book) });
const newestFirst = (items) => [...items].sort((a, b) => b.at - a.at).map(expand);
export const collectionPosts = (id) => newestFirst(find(id)?.items || []);
export const likedPosts = () => collectionPosts(byKind('likes')?.id);
export const libraryPosts = () => collectionPosts(byKind('library')?.id);

// ---------- comments ----------

export const commentsFor = (key) =>
  state.comments.filter((c) => refKey(c) === key).sort((a, b) => a.at - b.at);
// Every comment of yours in a chapter, oldest first. A post shows the whole
// chapter's comments, so one on Ezra 5:10 is met from any verse of Ezra 5.
export const commentsInChapter = (bookId, chapter) =>
  state.comments.filter((c) => c.book === bookId && c.chapter === chapter).sort((a, b) => a.at - b.at);

// ---------- importing this browser's data into the account ----------

const saveLocal = (local) => { try { localStorage.setItem(KEY, JSON.stringify(local)); } catch { /* storage unavailable */ } };

// What this browser saved while signed out, if it hasn't been added to an account yet.
// Null when there's nothing to add (or it's been added, or the offer was declined).
export function importable() {
  if (!remote) return null;
  const local = loadLocal();
  if (local.importedAt || local.importDismissed) return null;
  const count = (kind) => local.collections.filter((c) => c.kind === kind).reduce((n, c) => n + c.items.length, 0);
  const summary = { likes: count('likes'), inCollections: count('custom'), comments: local.comments.length };
  return summary.likes + summary.inCollections + summary.comments ? summary : null;
}
export function dismissImport() {
  saveLocal({ ...loadLocal(), importDismissed: true });
  notify();
}

// Adds this browser's likes, saves, collections and (optionally) comments to the
// account, then reloads the account so memory matches. Items already there are
// skipped by the database, so a second run adds nothing twice.
export async function importLocal({ includeComments = true } = {}) {
  if (!remote) return;
  const local = loadLocal();
  const items = [];
  for (const lc of local.collections) {
    if (!lc.items.length) continue;
    let target = lc.kind === 'custom'
      ? state.collections.find((c) => c.kind === 'custom' && c.name.toLowerCase() === lc.name.toLowerCase())
      : byKind(lc.kind);
    if (!target) {
      target = { id: newId(), kind: 'custom', name: lc.name, items: [] };
      await backend.activity.createCollection(target);
    }
    for (const i of lc.items) items.push({ collectionId: target.id, ...i });
  }
  for (let i = 0; i < items.length; i += 500) await backend.activity.addItems(items.slice(i, i + 500));
  if (includeComments) {
    const comments = local.comments.map((c) => ({ ...c, id: newId() })); // fresh ids: the same browser may feed two accounts
    for (let i = 0; i < comments.length; i += 500) await backend.activity.addComments(comments.slice(i, i + 500));
  }
  saveLocal({ ...local, importedAt: Date.now() });
  state = { ...empty(), ...await backend.fetchMyActivity() };
  friendComments.clear();
  commit();
}

// ---------- friends ----------

export const friends = () => state.friends.filter((f) => f.accepted);
export const friendRequests = () => state.friends.filter((f) => !f.accepted); // incoming and sent
export const friendshipWith = (userId) => state.friends.find((f) => f.id === userId) || null;

// Friendships change on the other person's side too, so a view that shows one
// asks the account again instead of trusting what was loaded at startup.
export async function refreshFriends() {
  if (!remote) return;
  const user = remote;
  const friends = await backend.fetchFriends();
  if (remote !== user) return; // signed out meanwhile
  state.friends = friends;
  friendComments.clear();
  commit();
}

export function requestFriend({ id, username, displayName }) {
  if (!remote || friendshipWith(id)) return;
  const before = state.friends;
  state.friends = [...state.friends, { id, username, displayName, accepted: false, incoming: false }];
  commit();
  persist(() => backend.friendships.request(id).catch((err) => {
    // One row per pair: if they asked first, show their request rather than an error.
    if (err.code === '23505') return refreshFriends();
    throw err;
  }), () => { state.friends = before; });
}
export function acceptFriend(userId) {
  const f = friendshipWith(userId);
  if (!f || f.accepted || !f.incoming) return;
  const before = state.friends;
  state.friends = state.friends.map((x) => (x === f ? { ...x, accepted: true } : x));
  friendComments.clear(); // their comments are visible now
  commit();
  persist(() => backend.friendships.accept(userId), () => { state.friends = before; });
}
// Declines, cancels or unfriends: all the same row going away.
export function removeFriend(userId) {
  const f = friendshipWith(userId);
  if (!f) return;
  const before = state.friends;
  state.friends = state.friends.filter((x) => x !== f);
  friendComments.clear();
  commit();
  persist(() => backend.friendships.remove(userId, f.incoming), () => { state.friends = before; });
}

// Your friends' comments on a chapter, each with its `author` profile. Fetched
// from the account and remembered for a minute, so scrolling a feed doesn't
// ask twice about the same chapter. Signed out there are no friends.
const friendComments = new Map(); // "JHN.3" -> { at, comments }
export async function friendsCommentsInChapter(bookId, chapter) {
  if (!remote || !friends().length) return [];
  const key = `${bookId}.${chapter}`;
  const hit = friendComments.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.comments;
  const byId = new Map(friends().map((f) => [f.id, f]));
  const comments = (await backend.commentsBy([...byId.keys()], bookId, chapter))
    .map(({ userId, ...c }) => ({ ...c, author: byId.get(userId) }));
  friendComments.set(key, { at: Date.now(), comments });
  return comments;
}

export function addComment(book, chapter, verse, text) {
  const comment = { id: newId(), book: book.id, chapter, verse: verse.number ?? verse, comment: text, at: Date.now() };
  const before = state.comments;
  state.comments = [...state.comments, comment];
  commit();
  persist(() => backend.activity.addComment(comment), () => { state.comments = before; });
  return comment;
}
export function deleteComment(id) {
  const before = state.comments;
  state.comments = state.comments.filter((c) => c.id !== id);
  commit();
  persist(() => backend.activity.removeComment(id), () => { state.comments = before; });
}

// One entry per post, ordered by your most recent comment on it.
export function commentedPosts() {
  const latest = new Map();
  for (const c of state.comments) {
    const k = refKey(c);
    if (!latest.has(k) || latest.get(k).at < c.at) latest.set(k, c);
  }
  return newestFirst([...latest.values()].map(({ book, chapter, verse, at }) => ({ book, chapter, verse, at })));
}
export const commentCount = () => state.comments.length;

// Pick up changes made in other tabs (signed out; signed in, each tab loads from the account).
window.addEventListener('storage', (e) => {
  if (e.key === KEY && !remote) {
    state = loadLocal();
    reindex();
    notify();
  }
});
