// Offer to add this browser's signed-out activity to the account: a banner on
// your activity page, the sheet that does it, and an entry in Settings.
import * as activity from './activity.js';
import { closeSheet, esc, openSheet, toast } from './ui.js';

const backdrop = document.getElementById('import-backdrop');
const body = document.getElementById('import-body');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "1 like, 12 saves, 3 in collections and 4 comments"
export function describe(s) {
  const parts = [];
  if (s.likes) parts.push(plural(s.likes, 'like'));
  if (s.saves) parts.push(plural(s.saves, 'save'));
  if (s.inCollections) parts.push(`${s.inCollections} in collections`);
  if (s.comments) parts.push(plural(s.comments, 'comment'));
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || 'nothing';
}

export function bannerHtml() {
  const s = activity.importable();
  if (!s) return '';
  return `
    <div class="banner">
      <p>This browser has <b>${esc(describe(s))}</b> from before you signed in.</p>
      <div class="banner-actions">
        <button class="primary-btn small" data-import="open">Add to my account</button>
        <button class="secondary-btn small" data-import="dismiss">Not now</button>
      </div>
    </div>`;
}

export function openImport() {
  const s = activity.importable();
  if (!s) return;
  body.innerHTML = `
    <p>Add this browser's <b>${esc(describe(s))}</b> to your account. Anything already there is left as it is.</p>
    ${s.comments ? `<label class="check-row"><input type="checkbox" name="comments" checked> Include the ${plural(s.comments, 'comment')}
      <small>Comments are visible to your friends.</small></label>` : ''}
    <div class="banner-actions">
      <button class="primary-btn" data-import="run">Add to my account</button>
      <button class="secondary-btn" data-import="dismiss">Not now</button>
    </div>
    <p class="auth-error" hidden></p>`;
  openSheet(backdrop);
}

// Banner buttons live inside other views, so this listens on the document.
document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-import]')?.dataset.import;
  if (!action) return;
  if (action === 'open') openImport();
  if (action === 'dismiss') {
    activity.dismissImport();
    closeSheet(backdrop);
  }
  if (action === 'run') {
    const btn = e.target.closest('button');
    const error = body.querySelector('.auth-error');
    btn.disabled = true;
    error.hidden = true;
    try {
      await activity.importLocal({ includeComments: body.querySelector('[name="comments"]')?.checked ?? false });
      closeSheet(backdrop);
      toast('Added to your account');
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      error.textContent = 'That didn’t finish. Check your connection and try again; nothing is added twice.';
      error.hidden = false;
    }
  }
});
