// Small shared helpers: escaping, avatars, icons, toasts, sheets, grid tiles.
import { handle } from './books.js';
import { getChapter } from './bible.js';

export const PALETTES = [
  'linear-gradient(135deg, #1e3c72, #2a5298)',
  'linear-gradient(135deg, #42275a, #734b6d)',
  'linear-gradient(135deg, #134e5e, #71b280)',
  'linear-gradient(135deg, #614385, #516395)',
  'linear-gradient(135deg, #8e2de2, #4a00e0)',
  'linear-gradient(135deg, #b24592, #f15f79)',
  'linear-gradient(135deg, #0f2027, #2c5364)',
  'linear-gradient(135deg, #c04848, #480048)',
  'linear-gradient(135deg, #3a6186, #89253e)',
  'linear-gradient(135deg, #5c258d, #4389a2)',
  'linear-gradient(135deg, #bc4e9c, #f80759)',
  'linear-gradient(135deg, #7f4a1e, #c9a24b)',
];

const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
export const ICONS = {
  heart: HEART,
  burst: HEART,
  comment: '<svg viewBox="0 0 24 24"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M21.5 2.5 10 14M21.5 2.5 14.5 21.5l-4.5-7.5-7.5-4.5z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
  stack: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="14" height="14" rx="2"/><path d="M17 21H5a2 2 0 0 1-2-2V7"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5zM4 20.5A1.5 1.5 0 0 0 5.5 22H20"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  library: '<svg viewBox="0 0 24 24"><path d="M3.5 4.5h4v15h-4zM9.5 4.5h4v15h-4zM14.6 6l3.9-1 3.9 14.5-3.9 1z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M15.5 14.2A5 5 0 0 1 21.5 19"/></svg>',
};

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function avatarHtml(name, { plain = false, cls = '' } = {}) {
  const initials = name.replace(/&.*/, '').split(/[\s_-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const hue = hash(name) % 360;
  return `<span class="avatar${plain ? ' plain' : ''}${cls ? ` ${cls}` : ''}" style="--avatar-bg: hsl(${hue} 45% 38%)"><b>${esc(initials || '?')}</b></span>`;
}

export const profileHref = (author, bookId) => `#/u/${handle(author)}${bookId ? `/${bookId}` : ''}`;

// Relative time for things that really happened (your own comments).
export function timeAgo(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const toastEl = document.getElementById('toast');
let toastTimer;
export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

// Horizontal rows (stories, book and collection chips) scroll with a mouse
// wheel on desktop, where there's no swipe; the vertical wheel moves them sideways.
document.addEventListener('wheel', (e) => {
  const row = e.target.closest('.stories, .highlights');
  if (!row || row.scrollWidth <= row.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  row.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });

export function openSheet(backdrop) {
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}
export function closeSheet(backdrop) {
  backdrop.hidden = true;
  if (document.getElementById('post-detail').hidden) document.body.style.overflow = '';
}
export const closeAllSheets = () => document.querySelectorAll('.sheet-backdrop:not([hidden])').forEach(closeSheet);

// A square grid tile for a verse. `onOpen` is called when it's tapped. Without
// `text` (saved activity keeps only references) the verse is looked up; each
// book loads once and is cached, so a grid of hundreds costs a few requests.
export function tileEl({ book, chapter, verse, text }, onOpen) {
  const ref = `${book.name} ${chapter}:${verse}`;
  const el = document.createElement('button');
  el.className = 'tile';
  el.style.setProperty('--slide-bg', PALETTES[hash(ref) % PALETTES.length]);
  el.setAttribute('aria-label', ref);
  el.innerHTML = `
    <span class="tile-text">${esc(text || '')}</span>
    <span class="tile-ref">${esc(ref)}</span>
    <span class="tile-stack">${ICONS.stack}</span>`;
  if (!text) {
    getChapter(book, chapter)
      .then((p) => { el.querySelector('.tile-text').textContent = p.verses.find((v) => v.number === verse)?.text || ''; })
      .catch(() => { /* the tile still shows its reference */ });
  }
  el.addEventListener('click', onOpen);
  return el;
}
