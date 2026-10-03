// Your account page: saved, liked and commented posts, plus who you follow.
import { handle } from './books.js';
import * as activity from './activity.js';
import { onDetailClose, openPosts } from './post.js';
import { ICONS, avatarHtml, esc, profileHref, tileEl } from './ui.js';

const view = document.getElementById('account-view');

const TABS = {
  saved: { icon: ICONS.save, label: 'Saved', list: activity.savedPosts, empty: 'Tap the bookmark on any post to save it here.' },
  liked: { icon: ICONS.heart, label: 'Liked', list: activity.likedPosts, empty: 'Posts you like (tap the heart or double-tap) show up here.' },
  comments: { icon: ICONS.comment, label: 'Comments', list: activity.commentedPosts, empty: 'Posts you comment on show up here.' },
};
let tab = 'saved';

export function showAccount(which) {
  tab = TABS[which] ? which : 'saved';
  view.hidden = false;
  render();
  window.scrollTo({ top: 0 });
}

export function hideAccount() {
  view.hidden = true;
  view.innerHTML = '';
}

function render() {
  const follows = [...activity.following()];
  const posts = TABS[tab].list();
  view.innerHTML = `
    <header class="profile-header">
      <div class="profile-row">
        ${avatarHtml('You', { plain: true, cls: 'profile-avatar' })}
        <div class="profile-stats">
          <div><b>${activity.savedPosts().length}</b><span>saved</span></div>
          <div><b>${activity.likedPosts().length}</b><span>liked</span></div>
          <div><b>${activity.commentCount()}</b><span>${activity.commentCount() === 1 ? 'comment' : 'comments'}</span></div>
        </div>
      </div>
      <div class="profile-name">You</div>
      <p class="profile-bio muted">Your activity is saved in this browser only!</p>
    </header>
    <div class="section-label">Following</div>
    ${follows.length
      ? `<div class="highlights">${follows.map((a) => `
          <a class="highlight" href="${profileHref(a)}">${avatarHtml(a)}<span class="hl-name">${esc(handle(a))}</span></a>`).join('')}</div>`
      : '<p class="hint-row">Follow authors from their profiles to see more of them in your feed.</p>'}
    <nav class="profile-tabs account-tabs">
      ${Object.entries(TABS).map(([id, t]) => `<a class="${id === tab ? 'on' : ''}" href="#/me/${id}" aria-label="${t.label}">${t.icon}</a>`).join('')}
    </nav>
    ${posts.length ? '<div class="grid" id="account-grid"></div>' : `<p class="empty">${TABS[tab].empty}</p>`}`;

  const grid = view.querySelector('#account-grid');
  posts.forEach((p, i) => grid.append(tileEl(p, () => openPosts(posts, i, { title: TABS[tab].label, subtitle: 'You' }))));
}

// Unliking or unsaving from the single-post view should update the grid behind it.
onDetailClose(() => { if (!view.hidden) render(); });
