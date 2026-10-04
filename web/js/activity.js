// Your own activity: likes, saves, custom collections and comments.
// Signed out, it lives in this browser's localStorage. (Signed in, it will
// live in your account; that's the next step.)
//
// Everything is a verse reference, { book: 'JHN', chapter: 3, verse: 16 },
// never the text: the app has the whole Bible and looks text up when needed.
import { BOOKS } from './books.js';

// Keeps the app's original name so existing saves, likes and comments are found.
const KEY = 'verse-feed:activity';
const bookById = new Map(BOOKS.map((b) => [b.id, b]));
export const newId = () => crypto.randomUUID();

// Likes and Saved are collections like any other; everyone has them.
const BUILTIN = [['likes', 'Likes'], ['saved', 'Saved']];
const empty = () => ({
  version: 2,
  collections: BUILTIN.map(([kind, name]) => ({ id: kind, kind, name, items: [] })),
  comments: [],
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

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data) return empty();
    return data.version === 2 ? { ...empty(), ...data } : upgrade(data);
  } catch {
    return empty();
  }
}

let state = load();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);

// "JHN.3.16": how the rest of the app names a post.
export const postKey = (book, chapter, verse) => `${book.id}.${chapter}.${verse}`;
const refKey = ({ book, chapter, verse }) => `${book}.${chapter}.${verse}`;

// For fast isLiked/isSaved checks while the feed renders.
let keys = new Map(); // collection id -> Set of keys
const reindex = () => { keys = new Map(state.collections.map((c) => [c.id, new Set(c.items.map(refKey))])); };
reindex();

function commit() {
  reindex();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}

// ---------- collections ----------

const find = (id) => state.collections.find((c) => c.id === id);
const byKind = (kind) => state.collections.find((c) => c.kind === kind);

export const collections = () => state.collections.map(({ id, kind, name, items }) => ({ id, kind, name, count: items.length }));
export const inCollection = (id, key) => keys.get(id)?.has(key) ?? false;
export const isLiked = (key) => inCollection(byKind('likes').id, key);
export const isSaved = (key) => inCollection(byKind('saved').id, key);

// `verse` may be a verse object ({ number, text }) or just the number.
export function setInCollection(id, book, chapter, verse, on) {
  const c = find(id);
  if (!c) return;
  const ref = { book: book.id, chapter, verse: verse.number ?? verse };
  c.items = c.items.filter((i) => refKey(i) !== refKey(ref));
  if (on) c.items.push({ ...ref, at: Date.now() });
  commit();
}
export const setLiked = (book, chapter, verse, on) => setInCollection(byKind('likes').id, book, chapter, verse, on);
export const setSaved = (book, chapter, verse, on) => setInCollection(byKind('saved').id, book, chapter, verse, on);

export function createCollection(name) {
  const c = { id: newId(), kind: 'custom', name, items: [] };
  state.collections.push(c);
  commit();
  return c.id;
}
export function renameCollection(id, name) {
  const c = find(id);
  if (c?.kind === 'custom') { c.name = name; commit(); }
}
export function deleteCollection(id) {
  if (find(id)?.kind !== 'custom') return;
  state.collections = state.collections.filter((c) => c.id !== id);
  commit();
}

// Items as the grids want them: { book (object), chapter, verse, at }, newest first.
const expand = (ref) => ({ ...ref, book: bookById.get(ref.book) });
const newestFirst = (items) => [...items].sort((a, b) => b.at - a.at).map(expand);
export const collectionPosts = (id) => newestFirst(find(id)?.items || []);
export const likedPosts = () => collectionPosts(byKind('likes').id);
export const savedPosts = () => collectionPosts(byKind('saved').id);

// ---------- comments ----------

export const commentsFor = (key) =>
  state.comments.filter((c) => refKey(c) === key).sort((a, b) => a.at - b.at);

export function addComment(book, chapter, verse, text) {
  const comment = { id: newId(), book: book.id, chapter, verse: verse.number ?? verse, comment: text, at: Date.now() };
  state.comments.push(comment);
  commit();
  return comment;
}
export function deleteComment(id) {
  state.comments = state.comments.filter((c) => c.id !== id);
  commit();
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

// Pick up changes made in other tabs.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = load();
    reindex();
    listeners.forEach((fn) => fn());
  }
});
