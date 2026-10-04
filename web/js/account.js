// Your account page: saved, liked and commented posts; signed in, also your
// friends and friend requests, and Settings (sign out, delete account).
import * as activity from './activity.js';
import * as backend from './backend.js';
import { onDetailClose, openPosts } from './post.js';
import { ICONS, avatarHtml, closeSheet, esc, openSheet, tileEl, toast } from './ui.js';

const view = document.getElementById('account-view');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsBody = document.getElementById('settings-body');

const TABS = {
  saved: { icon: ICONS.save, label: 'Saved', list: activity.savedPosts, empty: 'Tap the bookmark on any post to save it here.' },
  liked: { icon: ICONS.heart, label: 'Liked', list: activity.likedPosts, empty: 'Posts you like (tap the heart or double-tap) show up here.' },
  comments: { icon: ICONS.comment, label: 'Comments', list: activity.commentedPosts, empty: 'Posts you comment on show up here.' },
  friends: { icon: ICONS.people, label: 'Friends', signedIn: true },
};
const tabs = () => Object.entries(TABS).filter(([, t]) => !t.signedIn || backend.signedIn());
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

const personRow = (p, extra = '') => `
  <div class="result person">
    <a href="#/@${esc(p.username)}">${avatarHtml(p.displayName, { plain: true })}</a>
    <a class="result-text" href="#/@${esc(p.username)}"><b>${esc(p.displayName)}</b><small>@${esc(p.username)}</small></a>
    ${extra || `<a class="result-go" href="#/@${esc(p.username)}">${ICONS.arrow}</a>`}
  </div>`;

// Friends and requests: incoming first (they need an answer), then sent, then friends.
function friendsHtml() {
  const incoming = activity.friendRequests().filter((f) => f.incoming);
  const sent = activity.friendRequests().filter((f) => !f.incoming);
  const friends = activity.friends().sort((a, b) => a.displayName.localeCompare(b.displayName));
  if (!incoming.length && !sent.length && !friends.length) {
    return '<p class="empty">No friends yet. Find people in <a href="#/search">Search</a> and add them; friends see each other’s library and comments.</p>';
  }
  return `
    ${incoming.length ? `<div class="section-label">Requests</div>${incoming.map((p) => personRow(p, `
      <button class="primary-btn small" data-action="accept" data-id="${p.id}">Accept</button>
      <button class="secondary-btn small" data-action="remove" data-id="${p.id}">Decline</button>`)).join('')}` : ''}
    ${sent.length ? `<div class="section-label">Sent</div>${sent.map((p) => personRow(p, `
      <button class="secondary-btn small" data-action="remove" data-id="${p.id}">Cancel</button>`)).join('')}` : ''}
    ${friends.length ? `<div class="section-label">${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}</div>${friends.map((p) => personRow(p)).join('')}` : ''}`;
}

function render() {
  // A signed-in-only tab falls back to Saved until the account has signed in (e.g. during startup).
  const active = TABS[tab].signedIn && !backend.signedIn() ? 'saved' : tab;
  const posts = TABS[active].list ? TABS[active].list() : [];
  const name = backend.me?.profile?.displayName || 'You';
  view.innerHTML = `
    <header class="profile-header">
      <div class="profile-row">
        ${avatarHtml(name, { plain: true, cls: 'profile-avatar' })}
        <div class="profile-stats">
          <div><b>${activity.savedPosts().length}</b><span>saved</span></div>
          <div><b>${activity.likedPosts().length}</b><span>liked</span></div>
          <div><b>${activity.commentCount()}</b><span>${activity.commentCount() === 1 ? 'comment' : 'comments'}</span></div>
          ${backend.signedIn() ? `<div><b>${activity.friends().length}</b><span>${activity.friends().length === 1 ? 'friend' : 'friends'}</span></div>` : ''}
        </div>
      </div>
      ${identityHtml()}
    </header>
    <nav class="profile-tabs account-tabs">
      ${tabs().map(([id, x]) => `<a class="${id === active ? 'on' : ''}" href="#/me/${id}" aria-label="${x.label}">${x.icon}</a>`).join('')}
    </nav>
    ${!activity.loaded() ? '<div class="sentinel"><div class="spinner"></div></div>'
      : active === 'friends' ? friendsHtml()
      : posts.length ? '<div class="grid" id="account-grid"></div>' : `<p class="empty">${TABS[active].empty}</p>`}`;

  const grid = view.querySelector('#account-grid');
  if (grid) posts.forEach((p, i) => grid.append(tileEl(p, () => openPosts(posts, i, { title: TABS[active].label, subtitle: name }))));
  view.querySelector('.open-settings')?.addEventListener('click', openSettings);
}

view.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const person = activity.friendshipWith(btn.dataset.id);
  if (btn.dataset.action === 'accept') {
    activity.acceptFriend(btn.dataset.id);
    if (person) toast(`You and ${person.displayName} are now friends`);
  } else {
    activity.removeFriend(btn.dataset.id);
  }
});

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
// Signing in or out changes the header; the account's activity arriving fills the grid.
backend.onChange(() => { if (!view.hidden) render(); });
activity.onChange(() => { if (!view.hidden) render(); });
