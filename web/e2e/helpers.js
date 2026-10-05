// Shared steps: fresh accounts, sign-in codes read from Mailpit, opening a verse.
import { expect } from '@playwright/test';

export const MAILPIT = 'http://127.0.0.1:54344';

// Each test makes its own accounts, so nothing depends on the database's state.
let n = 0;
export function newPerson(label) {
  const id = `${Date.now().toString(36)}${(n++).toString(36)}`;
  return { email: `${label}-${id}@example.com`, username: `${label}_${id}`.slice(0, 20), display: `${label[0].toUpperCase()}${label.slice(1)} ${id.slice(-3)}` };
}

// Messages Mailpit holds for an address, newest first.
async function messagesTo(email) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  if (!res.ok) throw new Error(`Mailpit answered ${res.status}; is the local stack running?`);
  return (await res.json()).messages;
}

// The 6-digit code from the newest email to `email`, waiting for one newer than `before` emails.
export async function codeFor(email, before = 0) {
  for (let i = 0; i < 40; i++) {
    const messages = await messagesTo(email);
    if (messages.length > before) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
      const code = msg.Text.match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code arrived for ${email}`);
}

// Signs `page` in as `person`, choosing the username and display name if the account is new.
export async function signIn(page, person) {
  const before = (await messagesTo(person.email)).length;
  await page.goto('/#/signin');
  await page.getByLabel('Email').fill(person.email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('Code').fill(await codeFor(person.email, before));
  await page.getByRole('button', { name: 'Sign in' }).click();
  // A new account is asked for a username; a returning one lands on its page.
  const username = page.getByLabel('Username');
  await Promise.race([username.waitFor(), page.waitForURL(/#\/me$/)]);
  if (await username.isVisible()) {
    await username.fill(person.username);
    await page.getByLabel('Display name').fill(person.display);
    await page.getByRole('button', { name: 'Create profile' }).click();
  }
  await expect(page).toHaveURL(/#\/me$/);
  await expect(page.locator('.profile-title')).toHaveText(`@${person.username}`);
}

// Opens one verse as a post (through Search) and returns its article.
export async function openVerse(page, reference) {
  await page.goto('/#/search');
  await page.getByRole('searchbox').fill(reference);
  await page.locator('button.result').first().click();
  const post = page.locator('#post-detail article.post');
  await expect(post.locator('.ref')).toContainText(reference);
  return post;
}

// Waits until every request the page has made has been answered, so what was
// just done is in the account before the page is reloaded.
export const synced = (page) => page.waitForLoadState('networkidle');

// Opens the account menu (the top-bar button while on your own page).
export async function openAccountMenu(page) {
  await page.goto('/#/me');
  await expect(page.locator('#account-view')).toBeVisible();
  await page.locator('.topbar [data-nav="me"]').click();
  await expect(page.locator('#settings-backdrop')).toBeVisible();
}
