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

// Likes and Saved are collections like any other; everyone has them. (Accounts
// also have a Library, which exists to be seen by friends.)
const BUILTIN = [['likes', 'Likes'], ['saved', 'Saved']];
const empty = () => ({
  version: 2,
  collections: BUILTIN.map(([kind, name]) => ({ id: kind, kind, name, items: [] })),
  comments: [],
  friends: [], // signed in only: everyone with a friendship row, accepted or pending
  importedAt: null, // set once this browser's data has been added to an account
});

// Version 1 kept `liked` and `saved` maps with a copy of each verse's text, and
// a list of followed authors. Only the references and comments carry over.
function upgrade(v1) {
  const s = empty();
  const refs = (map) => Object.values(map || {}).map(({ book, chapter, verse, at }) => ({ book, chapter, verse, at }));
  s.collections[0].items = refs(v1.liked);
  s.collections[1].items = refs(v1.saved);
  s.comments = (v1.comments || []).map(({ id, book, chapter, verse, comment, at }) => ({ id, book, chapter, verse, comment, at }));
  return s;
}

function loadLocal() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data) return empty();
    return data.version === 2 ? { ...empty(), ...data } : upgrade(data);
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

// For fast isLiked/isSaved checks while the feed renders.
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
function persist(send, undo) {
  if (!remote) return;
  send().catch((err) => {
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
export const isSaved = (key) => inCollection(byKind('saved')?.id, key);

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
export const setSaved = (book, chapter, verse, on) => setInCollection(byKind('saved')?.id, book, chapter, verse, on);

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
export const savedPosts = () => collectionPosts(byKind('saved')?.id);

// ---------- comments ----------

export const commentsFor = (key) =>
  state.comments.filter((c) => refKey(c) === key).sort((a, b) => a.at - b.at);
// Every comment of yours in a chapter, oldest first. A post shows the whole
// chapter's comments, so one on Ezra 5:10 is met from any verse of Ezra 5.
export const commentsInChapter = (bookId, chapter) =>
  state.comments.filter((c) => c.book === bookId && c.chapter === chapter).sort((a, b) => a.at - b.at);

// ---------- friends ----------

export const friends = () => state.friends.filter((f) => f.accepted);
export const friendRequests = () => state.friends.filter((f) => !f.accepted); // incoming and sent
export const friendshipWith = (userId) => state.friends.find((f) => f.id === userId) || null;

export function requestFriend({ id, username, displayName }) {
  if (!remote || friendshipWith(id)) return;
  const before = state.friends;
  state.friends = [...state.friends, { id, username, displayName, accepted: false, incoming: false }];
  commit();
  persist(() => backend.friendships.request(id), () => { state.friends = before; });
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
