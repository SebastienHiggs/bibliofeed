// Your own activity: likes, saves and comments.
// Kept in this browser's localStorage; there are no accounts yet.
import { BOOKS } from './books.js';

// Keeps the app's original name so existing saves, likes and comments survive the rename.
const KEY = 'verse-feed:activity';
const bookById = new Map(BOOKS.map((b) => [b.id, b]));

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { liked: {}, saved: {}, comments: [], ...data };
  } catch {
    return { liked: {}, saved: {}, comments: [] };
  }
}
let state = load();
const listeners = new Set();

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  listeners.forEach((fn) => fn());
}
export const onChange = (fn) => listeners.add(fn);

export const postKey = (book, chapter, verse) => `${book.id}.${chapter}.${verse}`;

// Enough of a post to show it in a grid and reopen it later.
const snapshot = (book, chapter, verse) => ({ book: book.id, chapter, verse: verse.number, text: verse.text });
const expand = (snap) => ({ ...snap, book: bookById.get(snap.book) });

export const isLiked = (key) => Boolean(state.liked[key]);
export const isSaved = (key) => Boolean(state.saved[key]);

function toggle(kind, book, chapter, verse, on) {
  const key = postKey(book, chapter, verse.number);
  if (on) state[kind][key] = { ...snapshot(book, chapter, verse), at: Date.now() };
  else delete state[kind][key];
  commit();
}
export const setLiked = (book, chapter, verse, on) => toggle('liked', book, chapter, verse, on);
export const setSaved = (book, chapter, verse, on) => toggle('saved', book, chapter, verse, on);

export const commentsFor = (key) =>
  state.comments.filter((c) => c.key === key).sort((a, b) => a.at - b.at);

export function addComment(book, chapter, verse, text) {
  const comment = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    key: postKey(book, chapter, verse.number),
    ...snapshot(book, chapter, verse),
    comment: text,
    at: Date.now(),
  };
  state.comments.push(comment);
  commit();
  return comment;
}
export function deleteComment(id) {
  state.comments = state.comments.filter((c) => c.id !== id);
  commit();
}

const newestFirst = (items) => items.sort((a, b) => b.at - a.at).map(expand);
export const likedPosts = () => newestFirst(Object.values(state.liked));
export const savedPosts = () => newestFirst(Object.values(state.saved));
// One entry per post, ordered by your most recent comment on it.
export function commentedPosts() {
  const latest = new Map();
  for (const c of state.comments) if (!latest.has(c.key) || latest.get(c.key).at < c.at) latest.set(c.key, c);
  return newestFirst([...latest.values()]);
}
export const commentCount = () => state.comments.length;

// Pick up changes made in other tabs.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    state = load();
    listeners.forEach((fn) => fn());
  }
});
