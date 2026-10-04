// A single post: carousel, actions, caption, comments sheet, and the
// full-screen single-post view used by grids and search.
import { BOOKS, ageLabel, authorOf, handle } from './books.js';
import { getChapter } from './bible.js';
import { getComments, studyLinks } from './commentary.js';
import * as activity from './activity.js';
import * as backend from './backend.js';
import { ICONS, PALETTES, avatarHtml, closeAllSheets, esc, hash, openSheet, profileHref, timeAgo, toast } from './ui.js';

// Group the chapter into slides of roughly equal reading length.
function chunkVerses(verses, maxChars = 430) {
  const slides = [];
  let cur = [];
  let len = 0;
  for (const v of verses) {
    if (cur.length && len + v.text.length > maxChars) {
      slides.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(v);
    len += v.text.length;
  }
  if (cur.length) slides.push(cur);
  return slides;
}

export function skeletonHtml() {
  return `
      <div class="post-header"><span class="avatar shimmer"><b></b></span><div class="post-meta"><div class="bar shimmer" style="width:40%"></div></div></div>
      <div class="carousel shimmer"></div>
      <div class="post-body" style="padding-top:14px"><div class="bar shimmer" style="width:30%;margin-bottom:8px"></div><div class="bar shimmer" style="width:85%"></div></div>`;
}

export function renderPost(el, { book, chapter, verse, passage }) {
  const ref = `${book.name} ${chapter}:${verse.number}`;
  const key = activity.postKey(book, chapter, verse.number);
  const seed = hash(ref);
  const bg = PALETTES[seed % PALETTES.length];
  const author = authorOf(book, chapter);
  const user = handle(author);
  const age = ageLabel(book, chapter);
  const bookTag = book.name.replace(/\s/g, '').toLowerCase();
  const authorTag = user.replace(/_/g, '');
  const liked = activity.isLiked(key);

  const lenClass = verse.text.length > 380 ? 'xlong' : verse.text.length > 200 ? 'long' : '';
  const chunks = chunkVerses(passage.verses);
  const slidesHtml = [
    `<div class="slide hero" style="--slide-bg:${bg}">
       <blockquote class="${lenClass}">“${esc(verse.text)}”</blockquote>
       <div class="ref">${esc(ref)} · ${passage.translation}</div>
     </div>`,
    ...chunks.map((vs) => {
      const range = vs.length > 1 ? `${vs[0].number}–${vs[vs.length - 1].number}` : `${vs[0].number}`;
      const body = vs
        .map((v) => {
          const t = `<sup>${v.number}</sup>${esc(v.text)}`;
          return v.number === verse.number ? `<mark>${t}</mark>` : t;
        })
        .join(' ');
      return `<div class="slide context" style="--slide-bg:${bg}">
          <div class="ctx-title">${esc(book.name)} ${chapter}:${range}</div>
          <p>${body}</p>
        </div>`;
    }),
  ];
  const slideCount = slidesHtml.length;

  el.className = 'post';
  el.innerHTML = `
    <div class="post-header">
      <a href="${profileHref(author)}" aria-label="${esc(user)}’s profile">${avatarHtml(author)}</a>
      <div class="post-meta">
        <div><a class="user" href="${profileHref(author)}">${esc(user)}</a><span class="dot">•</span><span class="age" title="${esc(age.title)}">${age.text}</span></div>
        <a class="location" href="${profileHref(author, book.id)}">${esc(book.name)} ${chapter}</a>
      </div>
    </div>
    <div class="carousel">
      <div class="track">${slidesHtml.join('')}</div>
      <div class="slide-count">1/${slideCount}</div>
      <button class="nav-arrow prev" aria-label="Previous" hidden>${ICONS.prev}</button>
      <button class="nav-arrow next" aria-label="Next">${ICONS.next}</button>
    </div>
    <div class="actions">
      <button class="icon-btn like-btn${liked ? ' liked' : ''}" aria-label="Like" aria-pressed="${liked}">${ICONS.heart}</button>
      <button class="icon-btn comment-btn" aria-label="Comments">${ICONS.comment}</button>
      <button class="icon-btn share-btn" aria-label="Share">${ICONS.share}</button>
      <div class="dots"></div>
      <span class="spacer"></span>
      <button class="icon-btn save-btn${activity.isSaved(key) ? ' saved' : ''}" aria-label="Save">${ICONS.save}</button>
    </div>
    <div class="post-body">
      <p class="caption clamped"><a class="user" href="${profileHref(author)}">${esc(user)}</a><strong>${esc(ref)}</strong> — ${esc(verse.text)}
        <a class="tag" href="${profileHref(author, book.id)}">#${esc(bookTag)}</a>
        ${authorTag !== bookTag ? `<a class="tag" href="${profileHref(author)}">#${esc(authorTag)}</a>` : ''}</p>
      <button class="more-btn">more</button>
      <div class="comments-preview"><button class="view-comments">View comments</button></div>
      <button class="add-comment">Add a comment…</button>
    </div>`;

  // Carousel
  const track = el.querySelector('.track');
  const counter = el.querySelector('.slide-count');
  const prev = el.querySelector('.prev');
  const next = el.querySelector('.next');
  const dots = el.querySelector('.dots');
  let index = 0;
  const drawDots = () => {
    const max = 7;
    const start = Math.max(0, Math.min(index - Math.floor(max / 2), slideCount - max));
    const end = Math.min(slideCount, start + max);
    let html = '';
    for (let i = start; i < end; i++) {
      const edge = slideCount > max && ((i === start && start > 0) || (i === end - 1 && end < slideCount));
      html += `<i class="${i === index ? 'on' : ''}${edge ? ' small' : ''}"></i>`;
    }
    dots.innerHTML = slideCount > 1 ? html : '';
  };
  const update = () => {
    index = Math.round(track.scrollLeft / track.clientWidth);
    counter.textContent = `${index + 1}/${slideCount}`;
    prev.hidden = index === 0;
    next.hidden = index >= slideCount - 1;
    drawDots();
  };
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  prev.addEventListener('click', () => track.scrollBy({ left: -track.clientWidth }));
  next.addEventListener('click', () => track.scrollBy({ left: track.clientWidth }));
  if (slideCount === 1) next.hidden = true;
  drawDots();

  // Like / double-tap
  const likeBtn = el.querySelector('.like-btn');
  const setLiked = (on) => {
    if (on === likeBtn.classList.contains('liked')) return;
    likeBtn.classList.toggle('liked', on);
    likeBtn.setAttribute('aria-pressed', on);
    activity.setLiked(book, chapter, verse, on);
  };
  likeBtn.addEventListener('click', () => setLiked(!likeBtn.classList.contains('liked')));
  const carousel = el.querySelector('.carousel');
  carousel.addEventListener('dblclick', (e) => {
    if (e.target.closest('.nav-arrow')) return;
    setLiked(true);
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.innerHTML = ICONS.burst;
    carousel.append(burst);
    setTimeout(() => burst.remove(), 850);
  });

  el.querySelector('.save-btn').addEventListener('click', (e) => {
    const on = e.currentTarget.classList.toggle('saved');
    activity.setSaved(book, chapter, verse, on);
    toast(on ? 'Saved' : 'Removed from saved');
  });

  el.querySelector('.share-btn').addEventListener('click', async () => {
    const text = `“${verse.text}” — ${ref} (${passage.translation})`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Verse copied to clipboard');
      }
    } catch { /* cancelled */ }
  });

  const caption = el.querySelector('.caption');
  const moreBtn = el.querySelector('.more-btn');
  requestAnimationFrame(() => {
    if (caption.scrollHeight <= caption.clientHeight + 1) moreBtn.remove();
  });
  moreBtn.addEventListener('click', () => {
    caption.classList.remove('clamped');
    moreBtn.remove();
  });

  // Comments
  // Commentary is fetched only once the post is near the screen (or opened),
  // so long lists of posts don't fire hundreds of requests at once.
  const post = { book, chapter, verse, passage, ref, user, author, key };
  post.loadComments = () => (post.comments ??= getComments(book, chapter, verse.number));
  const preview = el.querySelector('.comments-preview');
  preview.querySelector('.view-comments').addEventListener('click', () => openComments(post));
  const drawPreview = async () => {
    const comments = await post.loadComments();
    const mine = activity.commentsFor(key);
    const total = comments.length + studyLinks(book, chapter, verse.number).length + mine.length;
    const latestMine = mine[mine.length - 1];
    const first = latestMine
      ? { handle: 'you', summary: latestMine.comment }
      : comments[0];
    preview.innerHTML =
      `<button class="view-comments">View all ${total} comments</button>` +
      (first ? `<div class="preview-comment"><span class="user">${esc(first.handle)}</span>${esc(first.summary)}</div>` : '');
    preview.querySelector('.view-comments').addEventListener('click', () => openComments(post));
  };
  post.onComment = drawPreview;
  el.querySelector('.comment-btn').addEventListener('click', () => openComments(post));
  el.querySelector('.add-comment').addEventListener('click', () => openComments(post, { focus: true }));
  el.drawPreview = drawPreview;
  previewObserver.observe(el);
}

const previewObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    previewObserver.unobserve(e.target);
    e.target.drawPreview?.();
  }
}, { rootMargin: '400px' });

// ---------- comments sheet ----------

const commentsBackdrop = document.getElementById('comments-backdrop');
const commentsBody = document.getElementById('comments-body');
const commentForm = document.getElementById('comment-form');
const commentInput = commentForm.querySelector('input');
let currentPost = null;

function drawMyComments() {
  const box = commentsBody.querySelector('#my-comments');
  if (!box || !currentPost) return;
  const mine = activity.commentsFor(currentPost.key);
  box.innerHTML = mine.length
    ? `<div class="comments-section-title">Your comments</div>` +
      mine
        .map((c) => `
        <div class="comment">
          ${avatarHtml('You', { plain: true })}
          <div class="comment-main">
            <span class="user">you</span>${esc(c.comment)}
            <div class="comment-actions"><span>${timeAgo(c.at)}</span><button class="delete-comment" data-id="${c.id}">Delete</button></div>
          </div>
        </div>`)
        .join('')
    : '';
}

commentsBody.addEventListener('click', (e) => {
  const del = e.target.closest('.delete-comment');
  if (!del) return;
  activity.deleteComment(del.dataset.id);
  drawMyComments();
  currentPost?.onComment?.();
});

commentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();
  if (!text || !currentPost) return;
  const { book, chapter, verse } = currentPost;
  activity.addComment(book, chapter, verse, text);
  commentInput.value = '';
  commentForm.querySelector('button').disabled = true;
  drawMyComments();
  currentPost.onComment?.();
  commentsBody.querySelector('#my-comments')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
commentInput.addEventListener('input', () => {
  commentForm.querySelector('button').disabled = !commentInput.value.trim();
});

export async function openComments(post, { focus = false } = {}) {
  currentPost = post;
  const { book, chapter, verse, passage, ref, user, author } = post;
  commentsBody.innerHTML = `
    <div class="comment caption-comment">
      <a href="${profileHref(author)}">${avatarHtml(author)}</a>
      <div class="comment-main"><a class="user" href="${profileHref(author)}">${esc(user)}</a><strong>${esc(ref)}</strong> — ${esc(verse.text)}</div>
    </div>
    <div id="my-comments"></div>
    <div class="sentinel"><div class="spinner"></div></div>`;
  drawMyComments();
  commentInput.value = '';
  commentForm.querySelector('button').disabled = true;
  openSheet(commentsBackdrop);
  if (focus) commentInput.focus();

  const comments = await post.loadComments();
  if (currentPost !== post) return;
  const links = studyLinks(book, chapter, verse.number);
  const commentHtml = comments
    .map((c, i) => {
      const covers = c.from == null ? `${book.name} ${chapter} intro` : c.from === verse.number ? ref : `${book.name} ${chapter}:${c.from}ff`;
      return `
      <div class="comment">
        ${avatarHtml(c.handle, { plain: true })}
        <div class="comment-main">
          <span class="user">${esc(c.handle)}</span><span class="text" data-i="${i}">${esc(c.summary)}</span>
          <div class="source">${esc(c.source)} · on ${esc(covers)}</div>
          <div class="comment-actions">
            ${c.full.length > c.summary.length ? `<button class="expand" data-i="${i}">Read more</button>` : ''}
            <a href="${esc(c.url)}" target="_blank" rel="noopener">Full commentary ↗</a>
          </div>
        </div>
      </div>`;
    })
    .join('');

  const linkHtml = links
    .map((l) => {
      const host = new URL(l.url).hostname.replace(/^www\./, '');
      return `
      <div class="comment">
        ${avatarHtml(host, { plain: true })}
        <div class="comment-main">
          <span class="user">${esc(host)}</span>${esc(l.label)}
          <div class="comment-actions"><a href="${esc(l.url)}" target="_blank" rel="noopener">Open ↗</a></div>
        </div>
      </div>`;
    })
    .join('');

  commentsBody.querySelector('.sentinel').outerHTML = `
    ${comments.length ? `<div class="comments-section-title">Commentary summaries</div>${commentHtml}` : '<div class="empty">No commentary summaries found for this verse.</div>'}
    <div class="comments-section-title">More free commentaries</div>
    ${linkHtml}
    <p class="copyright">${esc(passage.copyright)} Commentary summaries are excerpts of public-domain works via the Free Use Bible API (bible.helloao.org). ${backend.signedIn() ? 'Your comments are saved to your account.' : 'Your comments are saved in this browser only.'}</p>`;

  commentsBody.querySelectorAll('.expand').forEach((btn) => {
    btn.addEventListener('click', () => {
      const span = commentsBody.querySelector(`.text[data-i="${btn.dataset.i}"]`);
      span.textContent = comments[btn.dataset.i].full;
      span.classList.add('full');
      btn.remove();
    });
  });
}

// ---------- single post view ----------

const detail = document.getElementById('post-detail');
const detailBody = document.getElementById('detail-body');
const closeListeners = new Set();
export const onDetailClose = (fn) => closeListeners.add(fn);

const detailTitle = detail.querySelector('.detail-title b');
const detailUser = detail.querySelector('.detail-user');
let session = 0;
let moreObserver = null;

const findBook = (book) => (typeof book === 'string' ? BOOKS.find((b) => b.id === book) : book);

// Render one { book, chapter, verse } item as a post, or null if it can't load.
async function postEl(item) {
  const book = findBook(item.book);
  try {
    const passage = await getChapter(book, item.chapter);
    const verse = passage.verses.find((v) => v.number === item.verse) || passage.verses[0];
    const el = document.createElement('article');
    renderPost(el, { book, chapter: item.chapter, verse, passage });
    return el;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Open a scrollable list of posts, starting at `start`, in the same order as
// the grid they came from. `loadMore` (optional) returns further items when
// you reach the end.
export async function openPosts(items, start = 0, { title = 'Posts', subtitle = '', loadMore } = {}) {
  const id = ++session;
  detailTitle.textContent = title;
  detailUser.textContent = subtitle;
  detailBody.innerHTML = '<div class="sentinel"><div class="spinner"></div></div>';
  detail.hidden = false;
  detail.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  // Chapters are usually cached already (the grid loaded them), so render
  // everything up front; that way scrolling up from the tapped post doesn't jump.
  const els = await Promise.all(items.map(postEl));
  if (id !== session) return;
  detailBody.innerHTML = '';
  for (const el of els) if (el) detailBody.append(el);
  const target = els[start] || els.find(Boolean);
  if (!target) {
    detailBody.innerHTML = '<p class="empty">Couldn’t load this post.</p>';
    return;
  }
  // Wait for layout to settle (captions decide whether they need "more").
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (id !== session) return;
  detail.scrollTop = target.offsetTop - detail.querySelector('.detail-bar').offsetHeight;

  if (!loadMore) return;
  const sentinel = document.createElement('div');
  sentinel.className = 'sentinel';
  sentinel.innerHTML = '<div class="spinner"></div>';
  detailBody.append(sentinel);
  let busy = false;
  moreObserver = new IntersectionObserver(async (entries) => {
    if (busy || !entries.some((e) => e.isIntersecting)) return;
    busy = true;
    const more = await loadMore();
    if (id !== session) return;
    const newEls = (await Promise.all(more.map(postEl))).filter(Boolean);
    if (id !== session) return;
    if (!more.length) {
      moreObserver.disconnect();
      sentinel.remove();
      return;
    }
    sentinel.before(...newEls);
    busy = false;
    // Still at the bottom? Re-check by observing afresh.
    moreObserver.unobserve(sentinel);
    moreObserver.observe(sentinel);
  }, { root: detail, rootMargin: '800px' });
  moreObserver.observe(sentinel);
}

export function closeDetail() {
  if (detail.hidden) return;
  session++;
  moreObserver?.disconnect();
  moreObserver = null;
  detail.hidden = true;
  detailBody.innerHTML = '';
  document.body.style.overflow = '';
  closeListeners.forEach((fn) => fn());
}

// Open a single verse as a full post. `book` may be a book object or its id.
export function openPost(book, chapter, verse) {
  const b = findBook(book);
  return openPosts([{ book: b, chapter, verse }], 0, { subtitle: handle(authorOf(b, chapter)) });
}

detail.querySelector('.detail-back').addEventListener('click', closeDetail);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.sheet-backdrop:not([hidden])')) closeAllSheets();
  else closeDetail();
});
