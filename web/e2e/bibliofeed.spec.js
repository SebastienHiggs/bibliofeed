// A safety net for contributors: the flows that cross the browser/backend
// boundary, run against the local Supabase stack. Each test makes its own
// accounts; sign-in codes are read from Mailpit (see helpers.js).
import { test, expect } from '@playwright/test';
import { newPerson, openAccountMenu, openVerse, signIn, synced } from './helpers.js';

test('sign in with an emailed code, stay signed in across a reload, sign out', async ({ page }) => {
  const me = newPerson('alice');
  await signIn(page, me);
  await expect(page.locator('.profile-name')).toHaveText(me.display);

  await page.reload();
  await expect(page.locator('.profile-title')).toHaveText(`@${me.username}`);

  await openAccountMenu(page);
  await expect(page.locator('#settings-body a[href="/about"]')).toBeVisible(); // the site's pages are a tap away
  await page.locator('#settings-body .sign-out').click();
  await expect(page.locator('#toast')).toHaveText('Signed out');
  await expect(page.locator('.profile-bio')).toHaveText('Your activity is saved in this browser only.');
});

test('likes, saves and comments belong to the account and survive a reload', async ({ page }) => {
  await signIn(page, newPerson('bob'));
  const post = await openVerse(page, 'John 3:16');
  await post.locator('.like-btn').click();
  await post.locator('.save-btn').click();
  await post.locator('.add-comment').click();
  await page.locator('#comment-form input').fill('The whole gospel in one verse.');
  await page.locator('#comment-form button').click();
  await expect(page.locator('#comments-pane .comment')).toContainText('The whole gospel in one verse.');

  // Signed in, the account is the only store, so after a reload everything comes back from it.
  await synced(page);
  await page.reload();
  await page.goto('/#/me/liked');
  await expect(page.getByRole('button', { name: 'John 3:16' })).toBeVisible();
  await page.goto('/#/me/saved');
  await page.locator('[data-collection]', { hasText: 'Saved' }).click(); // the Saved tab opens on the Library
  await expect(page.getByRole('button', { name: 'John 3:16' })).toBeVisible();
  await page.goto('/#/me/comments');
  await expect(page.getByRole('button', { name: 'John 3:16' })).toBeVisible();
  const again = await openVerse(page, 'John 3:16');
  await expect(again.locator('.like-btn')).toHaveClass(/liked/);
  await expect(again.locator('.save-btn')).toHaveClass(/saved/);
  await again.locator('.comment-btn').click();
  await expect(page.locator('#comments-pane .comment')).toContainText('The whole gospel in one verse.');
});

test.describe.serial('friends', () => {
  const alice = newPerson('alice');
  const bob = newPerson('bob');
  let a; // Alice's page, in its own browser context
  let b; // Bob's

  test.beforeAll(async ({ browser }) => {
    a = await (await browser.newContext()).newPage();
    b = await (await browser.newContext()).newPage();
    await signIn(a, alice);
    await signIn(b, bob);
  });
  test.afterAll(async () => {
    await a?.context().close();
    await b?.context().close();
  });

  test('a friend request from one person is accepted by the other', async () => {
    // Alice finds Bob in People search and asks.
    await a.goto('/#/search');
    await a.getByRole('button', { name: 'People' }).click();
    await a.getByRole('searchbox').fill(bob.username);
    await a.getByRole('link', { name: `@${bob.username}` }).click();
    await expect(a).toHaveURL(new RegExp(`#/@${bob.username}$`));
    await a.getByRole('button', { name: 'Add friend' }).click();
    await expect(a.getByRole('button', { name: 'Requested' })).toBeVisible();

    // Bob opens the app afresh, sees the request on his Friends tab and accepts.
    await synced(a);
    await b.goto('/#/me/friends');
    await b.reload();
    await expect(b.locator('#account-view')).toContainText(alice.display);
    await b.getByRole('button', { name: 'Accept' }).click();
    await expect(b.locator('#account-view')).toContainText('1 friend');

    // Alice's view of Bob now says Friends.
    await synced(b);
    await a.reload();
    await expect(a.getByRole('button', { name: 'Friends', exact: true })).toBeVisible();
  });

  test("a friend's comment appears in the comments sheet", async () => {
    const post = await openVerse(b, 'Psalms 23:1');
    await post.locator('.add-comment').click();
    await b.locator('#comment-form input').fill('Still the best-known psalm.');
    await b.locator('#comment-form button').click();
    await expect(b.locator('#comments-pane .comment')).toContainText('Still the best-known psalm.');
    await synced(b);

    const seen = await openVerse(a, 'Psalms 23:1');
    await seen.locator('.comment-btn').click();
    const comment = a.locator('#comments-pane .comment');
    await expect(comment).toContainText(bob.display);
    await expect(comment).toContainText('Still the best-known psalm.');
  });
});

test("a browser's signed-out activity can be added to the account", async ({ page }) => {
  // Signed out: a like and a comment, kept in this browser only.
  const post = await openVerse(page, 'Psalms 23:1');
  await post.locator('.like-btn').click();
  await post.locator('.add-comment').click();
  await page.locator('#comment-form input').fill('Written before I had an account.');
  await page.locator('#comment-form button').click();
  await expect(page.locator('#comments-pane .comment')).toContainText('Written before I had an account.');

  await signIn(page, newPerson('carol'));
  const banner = page.locator('.banner');
  await expect(banner).toContainText('This browser has 1 like and 1 comment from before you signed in.');
  await banner.getByRole('button', { name: 'Add to my account' }).click();
  await page.locator('#import-body [data-import="run"]').click();
  await expect(page.locator('#toast')).toHaveText('Added to your account');
  await expect(banner).toBeHidden();

  await synced(page);
  await page.reload();
  for (const tab of ['liked', 'comments']) {
    await page.goto(`/#/me/${tab}`);
    await expect(page.getByRole('button', { name: 'Psalms 23:1' })).toBeVisible();
  }
});

test('a verse saved into a new collection is listed on the Saved tab', async ({ page }) => {
  await signIn(page, newPerson('dave'));
  const post = await openVerse(page, 'Genesis 1:1');
  await post.locator('.save-btn').click({ button: 'right' }); // right-click (or hold) picks the collection
  const sheet = page.locator('#collections-backdrop');
  await sheet.getByRole('button', { name: '+ New collection' }).click();
  await sheet.locator('input[name="name"]').fill('Beginnings');
  await sheet.getByRole('button', { name: 'Create' }).click();
  await expect(sheet.locator('.collection-row.on')).toContainText('Beginnings');

  await synced(page);
  await page.reload();
  await page.goto('/#/me/saved');
  await page.locator('[data-collection]', { hasText: 'Beginnings' }).click();
  await expect(page.getByRole('button', { name: 'Genesis 1:1' })).toBeVisible();
});

test('deleting the account removes it, so the same email starts afresh', async ({ page }) => {
  const erin = newPerson('erin');
  await signIn(page, erin);
  await openAccountMenu(page);
  const button = page.locator('#settings-body .delete-account');
  await button.click(); // the first tap only asks
  await expect(button).toContainText('Tap again');
  await button.click();
  await expect(page.locator('#toast')).toHaveText('Your account has been deleted');
  await expect(page.locator('.profile-bio')).toHaveText('Your activity is saved in this browser only.');

  // The profile went with the account: the same address is asked for a username again.
  const again = { ...newPerson('erin'), email: erin.email };
  await signIn(page, again);
  await expect(page.locator('.profile-name')).toHaveText(again.display);
});
