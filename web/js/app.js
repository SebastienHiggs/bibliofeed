// Entry point: the feed, the stories row, and routing between views.
//   #/               feed
//   #/search         search
//   #/me[/tab]       your saved / liked / commented posts
//   #/signin         sign in with an email code
//   #/u/<handle>[/BOOK]  an author's profile, optionally filtered to one book
import { ALL_AUTHORS, handle, randomChapter, randomFromWorks, worksOf } from './books.js';
import { getChapter } from './bible.js';
import * as activity from './activity.js';
import { closeDetail, renderPost, skeletonHtml } from './post.js';
import { hideProfile, showProfile } from './profile.js';
import { hideAccount, showAccount } from './account.js';
import { hideSearch, showSearch } from './search.js';
import { hideSignin, showSignin } from './signin.js';
import { avatarHtml, closeAllSheets, closeSheet, esc, profileHref } from './ui.js';

const feedView = document.getElementById('feed-view');
const feed = document.getElementById('feed');
const sentinel = document.getElementById('sentinel');
const topbarBack = document.getElementById('topbar-back');
const authorByHandle = new Map(ALL_AUTHORS.map((a) => [handle(a), a]));

// ---------- feed ----------

// Half the feed comes from authors you follow, if you follow anyone.
function pickChapter() {
  const follows = activity.following();
  if (follows.size && Math.random() < 0.5) return randomFromWorks([...follows].flatMap(worksOf));
  return randomChapter();
}

async function addPost() {
  const el = document.createElement('article');
  el.innerHTML = skeletonHtml();
  el.className = 'post skeleton';
  feed.append(el);

  for (let attempt = 0; attempt < 3; attempt++) {
    const { book, chapter } = pickChapter();
    try {
      const passage = await getChapter(book, chapter);
      if (!passage.verses.length) continue;
      const verse = passage.verses[Math.floor(Math.random() * passage.verses.length)];
      renderPost(el, { book, chapter, verse, passage });
      return;
    } catch (err) {
      console.error(err);
    }
  }
  el.className = 'post';
  el.innerHTML = '<div class="error">Couldn’t load this verse. <button>Try again</button></div>';
  el.querySelector('button').addEventListener('click', () => { el.remove(); addPost(); });
}

let loading = false;
async function loadMore(n = 3) {
  if (loading || feedView.hidden) return;
  loading = true;
  await Promise.all(Array.from({ length: n }, addPost));
  loading = false;
  // Keep filling if the sentinel is still on screen.
  if (!feedView.hidden && sentinel.getBoundingClientRect().top < window.innerHeight + 400) loadMore();
}

new IntersectionObserver((entries) => {
  if (entries.some((e) => e.isIntersecting)) loadMore();
}, { rootMargin: '600px' }).observe(sentinel);

// ---------- stories (authors, followed first) ----------

function renderStories() {
  const follows = activity.following();
  const authors = [...ALL_AUTHORS]
    .filter((a) => a !== 'Unknown')
    .sort((a, b) => follows.has(b) - follows.has(a));
  document.getElementById('stories').innerHTML = authors
    .map((a) => `<a class="story" href="${profileHref(a)}">${avatarHtml(a)}<span class="story-name">${esc(handle(a))}</span></a>`)
    .join('');
}
activity.onChange(renderStories);

// ---------- routing ----------

let feedScroll = 0;
let current = 'feed';

function setChrome(view, title) {
  document.body.dataset.view = view;
  topbarBack.hidden = !title;
  topbarBack.querySelector('span').textContent = title || '';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === view));
}

function route() {
  closeAllSheets();
  closeDetail();
  if (current === 'feed') feedScroll = window.scrollY;

  const hash = location.hash;
  const profile = hash.match(/^#\/u\/(\w+)(?:\/(\w+))?/);
  const author = profile && authorByHandle.get(profile[1]);
  const next = author ? 'profile'
    : hash.startsWith('#/me') ? 'me'
    : hash.startsWith('#/search') ? 'search'
    : hash.startsWith('#/signin') ? 'signin'
    : 'feed';

  if (current !== next || next === 'profile' || next === 'me') {
    hideProfile();
    hideAccount();
    hideSearch();
    hideSignin();
    feedView.hidden = next !== 'feed';
  }
  current = next;

  if (next === 'profile') {
    setChrome('profile', handle(author));
    showProfile(author, profile[2]);
  } else if (next === 'me') {
    setChrome('me', 'Your activity');
    showAccount(hash.split('/')[2]);
  } else if (next === 'search') {
    setChrome('search', 'Search');
    showSearch();
  } else if (next === 'signin') {
    setChrome('signin', 'Sign in');
    showSignin();
  } else {
    setChrome('feed', '');
    window.scrollTo({ top: feedScroll });
    if (!feed.children.length) loadMore();
  }
}
// Each history entry remembers how many in-app pages deep it is, so the back
// arrow can go back within the app but never out of it.
if (history.state?.depth == null) history.replaceState({ depth: 0 }, '');
let depth = history.state.depth;
window.addEventListener('hashchange', () => {
  if (history.state?.depth == null) history.replaceState({ depth: depth + 1 }, '');
  depth = history.state.depth;
  route();
});
topbarBack.addEventListener('click', (e) => {
  // Your activity, Search and Sign in are top-level pages: back always means the feed.
  if (current === 'me' || current === 'search' || current === 'signin') return; // follows href="#/"
  if (depth > 0) {
    e.preventDefault();
    history.back();
  }
});

// A link to the page you're already on scrolls to the top and closes overlays.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (!a) return;
  const same = a.getAttribute('href') === location.hash || (a.getAttribute('href') === '#/' && !location.hash);
  if (!same) return;
  e.preventDefault();
  closeAllSheets();
  closeDetail();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.querySelectorAll('.sheet-backdrop').forEach((bd) => {
  bd.addEventListener('click', (e) => {
    if (e.target === bd || e.target.closest('.close-sheet')) closeSheet(bd);
  });
});

renderStories();
route();
