// Another person's profile (#/@username): their name, the friend button, and,
// for friends, their Library. Profiles exist only for signed-in users.
import * as activity from './activity.js';
import * as backend from './backend.js';
import { openPosts } from './post.js';
import { avatarHtml, esc, tileEl, toast } from './ui.js';

const view = document.getElementById('user-view');
let current = null; // { profile, library } being shown
let gen = 0;

export async function showUser(username) {
  const my = ++gen;
  view.hidden = false;
  view.innerHTML = '<div class="sentinel"><div class="spinner"></div></div>';
  await backend.ready;
  if (my !== gen) return;
  if (!backend.signedIn()) {
    view.innerHTML = `<p class="empty">Sign in to see people's profiles.</p><div class="profile-buttons" style="padding: 0 16px"><a class="primary-btn" href="#/signin">Sign in</a></div>`;
    return;
  }
  if (username === backend.me.profile.username) {
    location.replace('#/me');
    return;
  }
  try {
    const profile = await backend.profileByUsername(username);
    if (my !== gen) return;
    if (!profile) {
      view.innerHTML = `<p class="empty">Nobody is called @${esc(username)}.</p>`;
      return;
    }
    current = { profile, library: null };
    render();
    window.scrollTo({ top: 0 });
    loadLibrary(my);
  } catch (err) {
    console.error(err);
    if (my === gen) view.innerHTML = '<p class="empty">Couldn’t load this profile. Check your connection.</p>';
  }
}

export function hideUser() {
  gen++;
  current = null;
  view.hidden = true;
  view.innerHTML = '';
}

// A friend's Library is theirs to show; the rules return nothing for anyone else.
async function loadLibrary(my) {
  if (!activity.friendshipWith(current.profile.id)?.accepted) return;
  try {
    const library = await backend.libraryOf(current.profile.id);
    if (my !== gen || !current) return;
    current.library = library;
    render();
  } catch (err) {
    console.error(err);
  }
}

// The one button says where the two of you stand, and changes it.
function buttonHtml(f) {
  if (!f) return '<button class="primary-btn friend-btn" data-action="request">Add friend</button>';
  if (f.accepted) return '<button class="secondary-btn friend-btn" data-action="unfriend">Friends</button>';
  if (f.incoming) return '<button class="primary-btn friend-btn" data-action="accept">Accept</button><button class="secondary-btn friend-btn" data-action="remove">Decline</button>';
  return '<button class="secondary-btn friend-btn" data-action="remove">Requested</button>';
}

function render() {
  if (!current) return;
  const { profile, library } = current;
  const f = activity.friendshipWith(profile.id);
  view.innerHTML = `
    <header class="profile-header">
      <div class="profile-row">
        ${avatarHtml(profile.displayName, { plain: true, cls: 'profile-avatar' })}
        <div class="profile-stats">
          ${f?.accepted ? `<div><b>${library ? library.length : '…'}</b><span>in library</span></div>` : ''}
        </div>
      </div>
      <div class="profile-name">${esc(profile.displayName)}</div>
      <div class="profile-title">@${esc(profile.username)}</div>
      <div class="profile-buttons">${buttonHtml(f)}<button class="secondary-btn share-profile">Share profile</button></div>
    </header>
    ${f?.accepted
      ? `<div class="section-label">Library</div>
         ${library === null ? '<div class="sentinel"><div class="spinner"></div></div>'
           : library.length ? '<div class="grid" id="user-grid"></div>'
           : `<p class="empty">${esc(profile.displayName)} hasn’t added anything to their library yet.</p>`}`
      : `<p class="hint-row">${f && !f.accepted && !f.incoming ? 'Once they accept, you’ll see each other’s library and comments.'
          : f?.incoming ? `${esc(profile.displayName)} wants to be friends. Friends see each other’s library and comments.`
          : 'Friends see each other’s library and comments on verses.'}</p>`}`;

  const grid = view.querySelector('#user-grid');
  if (grid) library.forEach((p, i) => grid.append(tileEl(p, () => openPosts(library, i, { title: 'Library', subtitle: profile.displayName }))));

  view.querySelector('.share-profile').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Profile link copied');
    } catch { toast(location.href); }
  });
}

view.addEventListener('click', (e) => {
  const btn = e.target.closest('.friend-btn');
  if (!btn || !current) return;
  const { profile } = current;
  const { action } = btn.dataset;
  if (action === 'request') {
    activity.requestFriend(profile);
    toast(`Friend request sent to ${profile.displayName}`);
  } else if (action === 'accept') {
    activity.acceptFriend(profile.id);
    toast(`You and ${profile.displayName} are now friends`);
    loadLibrary(gen);
  } else if (action === 'remove') {
    activity.removeFriend(profile.id);
  } else if (action === 'unfriend' && !btn.classList.contains('confirm')) {
    // Two taps: the first only asks.
    btn.classList.add('confirm');
    btn.textContent = 'Remove friend?';
    setTimeout(() => { btn.classList.remove('confirm'); btn.textContent = 'Friends'; }, 4000);
    return; // don't redraw: it would reset the button
  } else if (action === 'unfriend') {
    activity.removeFriend(profile.id);
    toast(`You and ${profile.displayName} are no longer friends`);
  }
  render();
});

// Friendships changing elsewhere (another tab, or the account loading) redraw the button.
activity.onChange(() => { if (!view.hidden && current) render(); });
