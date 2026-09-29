// Search: jump to a reference ("John 3:16", "ps 23"), a book, or an author.
import { AUTHORS, BOOKS, handle } from './books.js';
import { openPost } from './post.js';
import { ICONS, avatarHtml, esc, profileHref } from './ui.js';

const view = document.getElementById('search-view');
const AUTHOR_NAMES = [...new Set(BOOKS.map((b) => b.author))];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Common alternative names and abbreviations that a prefix match wouldn't catch.
const ALIASES = { psalm: 'PSA', jn: 'JHN', jhn: 'JHN', mk: 'MRK', mt: 'MAT', lk: 'LUK', songofsongs: 'SNG', song: 'SNG', canticles: 'SNG', philemon: 'PHM', phil: 'PHP', php: 'PHP', jas: 'JAS', jude: 'JUD', judg: 'JDG', ezek: 'EZK', eze: 'EZK', rev: 'REV', revelations: 'REV' };

function matchBooks(q) {
  const n = norm(q);
  if (!n) return [];
  const alias = ALIASES[n] && BOOKS.find((b) => b.id === ALIASES[n]);
  const exact = BOOKS.filter((b) => norm(b.name) === n || b.id.toLowerCase() === n);
  const prefix = BOOKS.filter((b) => norm(b.name).startsWith(n));
  // "john" should also find 1, 2 and 3 John.
  const numbered = BOOKS.filter((b) => /^\d/.test(b.name) && norm(b.name).slice(1).startsWith(n));
  return [...new Set([alias, ...exact, ...prefix, ...numbered].filter(Boolean))];
}

// "1 cor 13:4", "John 3 16", "ps23" -> { book, chapter, verse }
function parseReference(q) {
  const m = q.trim().match(/^(\d?\s*[a-z][a-z .]*?)\s*(\d+)(?:\s*[:.\s]\s*(\d+))?\s*$/i);
  if (!m) return null;
  const book = matchBooks(m[1])[0];
  const chapter = Number(m[2]);
  if (!book || chapter < 1 || chapter > book.chapters) return null;
  return { book, chapter, verse: m[3] ? Number(m[3]) : null };
}

function row({ href, avatar, title, sub, data = '' }) {
  const tag = href ? 'a' : 'button';
  return `<${tag} class="result"${href ? ` href="${href}"` : ''}${data}>
    ${avatar}
    <span class="result-text"><b>${title}</b><small>${sub}</small></span>
    <span class="result-go">${ICONS.arrow}</span>
  </${tag}>`;
}

function results(q) {
  const out = [];
  const ref = parseReference(q);
  if (ref) {
    const label = `${ref.book.name} ${ref.chapter}${ref.verse ? `:${ref.verse}` : ''}`;
    out.push(row({
      avatar: `<span class="result-icon">${ICONS.book}</span>`,
      title: esc(label),
      sub: `Open this ${ref.verse ? 'verse' : 'chapter'}`,
      data: ` data-book="${ref.book.id}" data-chapter="${ref.chapter}" data-verse="${ref.verse || 1}"`,
    }));
  }
  const n = norm(q);
  const authors = n
    ? AUTHOR_NAMES.filter((a) => norm(a).includes(n) || norm(AUTHORS[a]?.title || '').includes(n))
    : AUTHOR_NAMES;
  const books = n && !ref ? matchBooks(q) : [];

  if (books.length) {
    out.push('<div class="section-label">Books</div>');
    for (const b of books) {
      out.push(row({
        href: profileHref(b.author, b.id),
        avatar: `<span class="result-icon">${ICONS.book}</span>`,
        title: esc(b.name),
        sub: `${b.chapters} chapter${b.chapters > 1 ? 's' : ''} · ${esc(handle(b.author))}`,
      }));
    }
  }
  if (authors.length) {
    out.push(`<div class="section-label">${n ? 'Authors' : 'All authors'}</div>`);
    for (const a of authors) {
      out.push(row({ href: profileHref(a), avatar: avatarHtml(a), title: esc(handle(a)), sub: esc(AUTHORS[a]?.title || a) }));
    }
  }
  return out.length ? out.join('') : `<p class="empty">No matches for “${esc(q)}”. Try a book, an author or a reference like John 3:16.</p>`;
}

let query = '';

export function showSearch() {
  view.hidden = false;
  view.innerHTML = `
    <form class="search-bar" role="search">
      ${ICONS.search}
      <input type="search" placeholder="Search books, authors or John 3:16" aria-label="Search" autocomplete="off" enterkeyhint="go">
    </form>
    <div class="results"></div>`;
  const input = view.querySelector('input');
  const list = view.querySelector('.results');
  const draw = () => { list.innerHTML = results(input.value); };
  input.value = query;
  input.addEventListener('input', () => { query = input.value; draw(); });
  view.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    input.blur();
    list.querySelector('.result')?.click();
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('button.result');
    if (btn) openPost(btn.dataset.book, Number(btn.dataset.chapter), Number(btn.dataset.verse));
  });
  draw();
  window.scrollTo({ top: 0 });
  input.focus();
}

export function hideSearch() {
  view.hidden = true;
  view.innerHTML = '';
}
