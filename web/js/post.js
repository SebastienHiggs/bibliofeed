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
  post.loadCommentary = () => (post.commentary ??= getComments(book, chapter, verse.number));
  const preview = el.querySelector('.comments-preview');
  preview.querySelector('.view-comments').addEventListener('click', () => openComments(post));
  // "View commentary · 3 comments", then the latest comment in the chapter (or the first commentary line).
  const drawPreview = async () => {
    const [commentary, friendComments] = await Promise.all([post.loadCommentary(), activity.friendsCommentsInChapter(book.id, chapter)]);
    post.friendComments = friendComments;
    const all = chapterComments(post);
    const latest = all[all.length - 1];
    const n = all.length;
    const line = latest
      ? `<span class="user">${latest.author ? esc(latest.author.displayName) : 'you'}</span>${latest.verse !== verse.number ? `<span class="verse-tag">v. ${latest.verse}</span>` : ''}${esc(latest.comment)}`
      : commentary[0] ? `<span class="user">${esc(commentary[0].handle)}</span>${esc(commentary[0].summary)}` : '';
    preview.innerHTML =
      `<button class="view-comments">View commentary${n ? ` · ${n} comment${n === 1 ? '' : 's'}` : ''}</button>` +
      (line ? `<div class="preview-comment">${line}</div>` : '');
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
// Two panes you swipe between (or tap the tabs): Commentary (the exegesis,
// first), then Comments: yours and your friends', on this verse and elsewhere
// in the chapter. Every list shows a few items and a "Show more".

const commentsBackdrop = document.getElementById('comments-backdrop');
const commentsTitle = document.getElementById('comments-title');
const commentsCaption = document.getElementById('comments-caption');
const commentsTabs = document.getElementById('comments-tabs');
const panes = document.getElementById('comments-panes');
const commentaryPane = document.getElementById('commentary-pane');
const commentsPane = document.getElementById('comments-pane');
const commentForm = document.getElementById('comment-form');
const commentInput = commentForm.querySelector('input');
let currentPost = null;
const SHOW = 3; // items per list before "Show more"
let expanded = new Set(); // lists opened with "Show more" for the current post

function showPane(i) {
  panes.scrollTo({ left: i * panes.clientWidth, behavior: 'smooth' });
}
panes.addEventListener('scroll', () => {
  const i = Math.round(panes.scrollLeft / panes.clientWidth);
  commentsTabs.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', i === j));
}, { passive: true });
commentsTabs.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) showPane(Number(b.dataset.pane));
});

// A list capped at SHOW items. `tail` lists (a conversation) keep the newest
// and offer the earlier ones; others keep the first and offer the rest.
function cappedList(items, title, section, render, { tail = false } = {}) {
  if (!items.length) return '';
  const all = expanded.has(section) || items.length <= SHOW;
  const shown = all ? items : tail ? items.slice(-SHOW) : items.slice(0, SHOW);
  const hidden = items.length - shown.length;
  const more = hidden ? `<button class="show-more" data-section="${section}">Show ${hidden} ${tail ? 'earlier' : 'more'}</button>` : '';
  return `<div class="comments-section-title">${title}</div>${tail ? more : ''}${shown.map(render).join('')}${tail ? '' : more}`;
}

// Yours have no `author` and can be deleted; a friend's shows their display name.
function commentHtml(c, { verseTag = false } = {}) {
  const name = c.author ? c.author.displayName : 'You';
  const who = c.author ? `<a class="user" href="#/@${esc(c.author.username)}">${esc(name)}</a>` : '<span class="user">you</span>';
  return `
    <div class="comment">
      ${c.author ? `<a href="#/@${esc(c.author.username)}">${avatarHtml(name, { plain: true })}</a>` : avatarHtml(name, { plain: true })}
      <div class="comment-main">
        ${who}${verseTag ? `<button class="verse-tag" data-verse="${c.verse}">v. ${c.verse}</button>` : ''}${esc(c.comment)}
        <div class="comment-actions"><span>${timeAgo(c.at)}</span>${c.author ? '' : `<button class="delete-comment" data-id="${c.id}">Delete</button>`}</div>
      </div>
    </div>`;
}

// Everyone's comments on the post's chapter: yours from memory, friends' as fetched for this post.
const chapterComments = (post) =>
  [...activity.commentsInChapter(post.book.id, post.chapter), ...(post.friendComments || [])].sort((a, b) => a.at - b.at);

function drawComments() {
  if (!currentPost) return;
  const { book, chapter, verse } = currentPost;
  const all = chapterComments(currentPost);
  const onVerse = all.filter((c) => c.verse === verse.number);
  const elsewhere = all.filter((c) => c.verse !== verse.number).sort((a, b) => a.verse - b.verse || a.at - b.at);
  commentsTabs.lastElementChild.textContent = all.length ? `Comments (${all.length})` : 'Comments';
  commentsPane.innerHTML = (all.length
    ? cappedList(onVerse, `On ${chapter}:${verse.number}`, 'verse', (c) => commentHtml(c), { tail: true })
      + cappedList(elsewhere, `Elsewhere in ${esc(book.name)} ${chapter}`, 'chapter', (c) => commentHtml(c, { verseTag: true }))
    : `<p class="empty">No comments yet on ${esc(book.name)} ${chapter}. Yours would be the first.</p>`)
    + `<p class="copyright">${backend.signedIn() ? 'Your comments are saved to your account.' : 'Your comments are saved in this browser only.'}</p>`;
}

function drawCommentary(commentary, links) {
  const { book, chapter, verse, ref, passage } = currentPost;
  const summary = (c, i) => {
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
  };
  const link = (l) => {
    const host = new URL(l.url).hostname.replace(/^www\./, '');
    return `
      <div class="comment">
        ${avatarHtml(host, { plain: true })}
        <div class="comment-main">
          <span class="user">${esc(host)}</span>${esc(l.label)}
          <div class="comment-actions"><a href="${esc(l.url)}" target="_blank" rel="noopener">Open ↗</a></div>
        </div>
      </div>`;
  };
  // Summaries keep their index so "Read more" can find the full text after the list is capped.
  const indexed = commentary.map((c, i) => ({ ...c, i }));
  commentaryPane.innerHTML = `
    ${commentary.length
      ? cappedList(indexed, 'Commentary summaries', 'commentary', (c) => summary(c, c.i))
      : '<div class="empty">No commentary summaries found for this verse.</div>'}
    <div class="comments-section-title">More free commentaries</div>
    ${links.map(link).join('')}
    <p class="copyright">${esc(passage.copyright)} Commentary summaries are excerpts of public-domain works via the Free Use Bible API (bible.helloao.org).</p>`;
}

panes.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || !currentPost) return;
  if (btn.classList.contains('show-more')) {
    expanded.add(btn.dataset.section);
    if (btn.dataset.section === 'commentary') drawCommentary(currentPost.commentary, studyLinks(currentPost.book, currentPost.chapter, currentPost.verse.number));
    else drawComments();
  } else if (btn.classList.contains('delete-comment')) {
    activity.deleteComment(btn.dataset.id);
    drawComments();
    currentPost.onComment?.();
  } else if (btn.classList.contains('verse-tag')) {
    // Go to that verse's own post, where the comment sits under "On 5:3".
    closeAllSheets();
    openPost(currentPost.book, currentPost.chapter, Number(btn.dataset.verse));
  } else if (btn.classList.contains('expand')) {
    const span = commentaryPane.querySelector(`.text[data-i="${btn.dataset.i}"]`);
    span.textContent = currentPost.commentary[btn.dataset.i].full;
    span.classList.add('full');
    btn.remove();
  }
});

commentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();
  if (!text || !currentPost) return;
  const { book, chapter, verse } = currentPost;
  activity.addComment(book, chapter, verse, text);
  commentInput.value = '';
  commentForm.querySelector('button').disabled = true;
  drawComments();
  currentPost.onComment?.();
  showPane(1);
  commentsPane.scrollTop = 0;
});
commentInput.addEventListener('input', () => {
  commentForm.querySelector('button').disabled = !commentInput.value.trim();
});

export async function openComments(post, { focus = false } = {}) {
  currentPost = post;
  expanded = new Set();
  const { book, chapter, verse, ref, user, author } = post;
  commentsTitle.textContent = ref;
  commentsCaption.innerHTML = `<a class="user" href="${profileHref(author)}">${esc(user)}</a>${esc(verse.text)}`;
  commentaryPane.innerHTML = '<div class="sentinel"><div class="spinner"></div></div>';
  drawComments();
  commentInput.value = '';
  commentInput.placeholder = `Comment on ${book.name} ${chapter}:${verse.number}…`;
  commentForm.querySelector('button').disabled = true;
  openSheet(commentsBackdrop);
  panes.scrollTo({ left: 0 });
  if (focus) commentInput.focus();

  // Friends' comments arrive (or refresh) while the sheet is open; redraw when they do.
  activity.friendsCommentsInChapter(book.id, chapter).then((fc) => {
    if (currentPost !== post) return;
    post.friendComments = fc;
    drawComments();
  }).catch(console.error);

  const commentary = await post.loadCommentary();
  if (currentPost !== post) return;
  drawCommentary(commentary, studyLinks(book, chapter, verse.number));
}

// The account's comments arriving, or a change made elsewhere, redraws an open sheet.
activity.onChange(() => { if (!commentsBackdrop.hidden) drawComments(); });

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
