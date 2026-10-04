// Your account page: saved, liked and commented posts, who you follow, and
// (signed in) your settings: sign out and delete account.
import { handle } from './books.js';
import * as activity from './activity.js';
import * as backend from './backend.js';
import { onDetailClose, openPosts } from './post.js';
import { ICONS, avatarHtml, closeSheet, esc, openSheet, profileHref, tileEl, toast } from './ui.js';

const view = document.getElementById('account-view');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsBody = document.getElementById('settings-body');

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

// The header's identity line and buttons depend on whether you're signed in.
function identityHtml() {
  const who = backend.me?.profile;
  if (who) {
    return `
      <div class="profile-name">${esc(who.displayName)}</div>
      <div class="profile-title">@${esc(who.username)}</div>
      <div class="profile-buttons"><button class="secondary-btn open-settings">Settings</button></div>`;
  }
  if (backend.me) {
    return `
      <div class="profile-name">You</div>
      <p class="profile-bio muted">Your account needs a username before friends can find you.</p>
      <div class="profile-buttons"><a class="primary-btn" href="#/signin">Choose a username</a></div>`;
  }
  return `
    <div class="profile-name">You</div>
    <p class="profile-bio muted">Your activity is saved in this browser only${backend.configured ? '.' : '!'}</p>
    ${backend.configured ? '<div class="profile-buttons"><a class="primary-btn" href="#/signin">Sign in</a></div>' : ''}`;
}

function render() {
  const follows = [...activity.following()];
  const posts = TABS[tab].list();
  const name = backend.me?.profile?.displayName || 'You';
  view.innerHTML = `
    <header class="profile-header">
      <div class="profile-row">
        ${avatarHtml(name, { plain: true, cls: 'profile-avatar' })}
        <div class="profile-stats">
          <div><b>${activity.savedPosts().length}</b><span>saved</span></div>
          <div><b>${activity.likedPosts().length}</b><span>liked</span></div>
          <div><b>${activity.commentCount()}</b><span>${activity.commentCount() === 1 ? 'comment' : 'comments'}</span></div>
        </div>
      </div>
      ${identityHtml()}
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
  posts.forEach((p, i) => grid.append(tileEl(p, () => openPosts(posts, i, { title: TABS[tab].label, subtitle: name }))));
  view.querySelector('.open-settings')?.addEventListener('click', openSettings);
}

// ---------- settings sheet ----------

function openSettings() {
  const who = backend.me?.profile;
  settingsBody.innerHTML = `
    <p class="settings-who">Signed in as <b>${esc(who.displayName)}</b> @${esc(who.username)}</p>
    <button class="menu-item sign-out">Sign out</button>
    <button class="menu-item danger delete-account">Delete account…</button>
    <p class="hint-row">Deleting your account removes your profile and everything in it. It can’t be undone.</p>`;
  openSheet(settingsBackdrop);
}

settingsBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  try {
    if (btn.classList.contains('sign-out')) {
      btn.disabled = true;
      await backend.signOut();
      closeSheet(settingsBackdrop);
      toast('Signed out');
    } else if (btn.classList.contains('delete-account') && !btn.classList.contains('confirm')) {
      // Two taps: the first only asks.
      btn.classList.add('confirm');
      btn.textContent = 'Tap again to delete your account and everything in it';
      setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = 'Delete account…'; }, 5000);
    } else if (btn.classList.contains('delete-account')) {
      btn.disabled = true;
      await backend.deleteAccount();
      closeSheet(settingsBackdrop);
      toast('Your account has been deleted');
    }
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    toast(err.message || 'Something went wrong');
  }
});

// Unliking or unsaving from the single-post view should update the grid behind it.
onDetailClose(() => { if (!view.hidden) render(); });
// Signing in or out (here or in another tab) changes the header.
backend.onChange(() => { if (!view.hidden) render(); });
