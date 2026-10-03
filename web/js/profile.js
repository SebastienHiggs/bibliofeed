// Author profile: bio, stats, follow, per-book filter and a grid of verses.
import { AUTHORS, handle, randomFromWorks, worksOf } from './books.js';
import { getChapter } from './bible.js';
import * as activity from './activity.js';
import { openPosts } from './post.js';
import { ICONS, avatarHtml, esc, tileEl, toast } from './ui.js';

const view = document.getElementById('profile-view');
let profile = null; // { author, works, filter, seen, items, pending, done, misses, gen }
let gen = 0;

const observer = new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) loadGrid();
}, { rootMargin: '600px' });

const abbrev = (book) => book.id.charAt(0) + book.id.slice(1).toLowerCase();

// "Psalms (12)" when an author wrote only some of a book.
const workName = (w) => (w.chapters.length < w.book.chapters ? `${w.book.name} (${w.chapters.length})` : w.book.name);

export function showProfile(author, bookId) {
  const works = worksOf(author);
  const chapters = works.reduce((n, w) => n + w.chapters.length, 0);
  const info = AUTHORS[author] || { title: '', bio: '', lived: '' };
  const filter = works.find((w) => w.book.id === bookId) || null;
  const onlyPsalms = works.length === 1 && works[0].book.id === 'PSA';

  view.innerHTML = `
    <header class="profile-header">
      <div class="profile-row">
        ${avatarHtml(author, { plain: true, cls: 'profile-avatar' })}
        <div class="profile-stats">
          <div><b>${works.length}</b><span>${works.length === 1 ? 'book' : 'books'}</span></div>
          <div><b>${chapters}</b><span>${onlyPsalms ? (chapters === 1 ? 'psalm' : 'psalms') : 'chapters'}</span></div>
          <div><b>${esc(info.lived || 'Unknown')}</b><span>lived</span></div>
        </div>
      </div>
      <div class="profile-name">${esc(author)}</div>
      ${info.title ? `<div class="profile-title">${esc(info.title)}</div>` : ''}
      <p class="profile-bio">${esc(info.bio)}</p>
      <div class="profile-books">${ICONS.book}<span>${works.map((w) => esc(workName(w))).join(', ')}</span></div>
      <div class="profile-buttons">
        <button class="follow-btn"></button>
        <button class="secondary-btn share-profile">Share profile</button>
      </div>
    </header>
    ${works.length > 1 ? `
    <div class="highlights">
      <button class="highlight${filter ? '' : ' on'}" data-book=""><span class="hl-ring"><b>All</b></span><span class="hl-name">All</span></button>
      ${works.map((w) => `<button class="highlight${filter === w ? ' on' : ''}" data-book="${w.book.id}"><span class="hl-ring"><b>${abbrev(w.book)}</b></span><span class="hl-name">${esc(w.book.name)}</span></button>`).join('')}
    </div>` : ''}
    <div class="grid" id="profile-grid"></div>
    <div class="sentinel" id="profile-sentinel"><div class="spinner"></div></div>`;

  profile = { author, works, filter, seen: new Set(), items: [], pending: null, done: false, misses: 0, gen: ++gen };
  view.hidden = false;
  window.scrollTo({ top: 0 });

  const followBtn = view.querySelector('.follow-btn');
  const drawFollow = () => {
    const on = activity.isFollowing(author);
    followBtn.classList.toggle('following', on);
    followBtn.textContent = on ? 'Following' : 'Follow';
  };
  drawFollow();
  followBtn.addEventListener('click', () => {
    const on = !activity.isFollowing(author);
    activity.setFollowing(author, on);
    drawFollow();
    toast(on ? `You’ll see more from ${handle(author)} in your feed` : `Unfollowed ${handle(author)}`);
  });
  view.querySelector('.share-profile').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Profile link copied');
    } catch { toast(location.href); }
  });
  view.querySelector('.highlights')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.highlight');
    if (!btn) return;
    view.querySelectorAll('.highlight').forEach((h) => h.classList.toggle('on', h === btn));
    profile.filter = works.find((w) => w.book.id === btn.dataset.book) || null;
    // Keep the URL in step so the filtered view can be shared.
    history.replaceState(history.state, '', `#/u/${handle(author)}${profile.filter ? `/${profile.filter.book.id}` : ''}`);
    resetGrid();
  });

  observer.disconnect();
  observer.observe(document.getElementById('profile-sentinel'));
  loadGrid();
}

export function hideProfile() {
  profile = null;
  gen++;
  observer.disconnect();
  view.hidden = true;
  view.innerHTML = '';
}

function resetGrid() {
  Object.assign(profile, { gen: ++gen, pending: null, done: false, misses: 0, items: [] });
  profile.seen.clear();
  document.getElementById('profile-grid').innerHTML = '';
  document.getElementById('profile-sentinel').hidden = false;
  loadGrid();
}

const sentinelOnScreen = () =>
  document.getElementById('profile-sentinel')?.getBoundingClientRect().top < window.innerHeight + 400;

// Loads the next batch of tiles. Concurrent callers share the same batch, so
// the grid and the post list opened from it can both ask for more.
function loadGrid() {
  const st = profile;
  if (!st || st.done || view.hidden) return Promise.resolve();
  if (!st.pending) {
    const p = loadBatch(st).finally(() => {
      if (st.pending === p) st.pending = null;
      if (st === profile && !st.done && sentinelOnScreen()) loadGrid();
    });
    st.pending = p;
  }
  return st.pending;
}

// Each batch fetches a few chapters and turns several verses from each into tiles.
async function loadBatch(st) {
  const batchGen = st.gen;
  const pool = st.filter ? [st.filter] : st.works;
  const picks = Array.from({ length: 3 }, () => randomFromWorks(pool));
  const results = await Promise.all(
    picks.map((p) => getChapter(p.book, p.chapter).then((passage) => ({ ...p, passage })).catch(() => null)),
  );
  if (st !== profile || batchGen !== st.gen) return; // navigated away or filter changed

  const grid = document.getElementById('profile-grid');
  let added = 0;
  for (const r of results) {
    if (!r) continue;
    const fresh = r.passage.verses.filter((v) => !st.seen.has(`${r.book.id}.${r.chapter}.${v.number}`));
    for (let i = 0; i < 4 && fresh.length; i++) {
      const verse = fresh.splice(Math.floor(Math.random() * fresh.length), 1)[0];
      st.seen.add(`${r.book.id}.${r.chapter}.${verse.number}`);
      const item = { book: r.book, chapter: r.chapter, verse: verse.number, text: verse.text };
      const index = st.items.push(item) - 1;
      grid.append(tileEl(item, () => openFromGrid(st, index)));
      added++;
    }
  }
  st.misses = added ? 0 : st.misses + 1;
  if (st.misses >= 3) {
    st.done = true;
    document.getElementById('profile-sentinel').hidden = true;
  }
}

// Tapping a tile opens the grid's posts as a list, in grid order, starting at
// the tapped one. Reaching the end loads more, just like scrolling the grid.
function openFromGrid(st, index) {
  let shown = st.items.length;
  const loadMore = async () => {
    // A batch can come back empty (e.g. all repeats), so keep going until it's done.
    while (st === profile && st.items.length <= shown && !st.done) await loadGrid();
    if (st !== profile) return [];
    const more = st.items.slice(shown);
    shown = st.items.length;
    return more;
  };
  openPosts(st.items.slice(0, shown), index, { subtitle: handle(st.author), loadMore });
}
