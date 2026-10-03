# Plan: accounts and friends with a Supabase backend

Status: **proposal, ready for review**. Nothing in `web/` has changed yet.

This folder holds:

| File | What it is |
| --- | --- |
| `README.md` | This plan: what we're building, the decisions behind it, and how the app changes |
| [`schema.sql`](schema.sql) | The whole backend: 5 tables, 3 functions, 1 trigger and the access rules |
| [`tests/`](tests/) | Checks that the access rules do what this plan says. `tests/run.sh` runs them on a local Postgres |

## For the reviewer

This plan came out of a long conversation with the project owner. Everything under
[Decisions](#decisions) was agreed with them, and the reasons are written down so you don't have to
re-derive them. Please review:

1. **The access rules in `schema.sql`.** Can any user read or change something they shouldn't? The tests
   cover the cases we thought of. Add any you think are missing.
2. **The Supabase details listed under [Things to verify](#things-to-verify).** These were written from
   memory of how Supabase works and haven't been tried on a real project.
3. **Simplicity.** The owner's strongest preference is a backend that is as small and maintainable as
   possible. Flag anything that could be removed. Be wary of adding things.
4. **The front-end plan** under [Changes to the web app](#changes-to-the-web-app), against the code in `web/js/`.

The open questions at the end are for the owner, not the reviewer, but say so if you have a view.

## What we're adding

1. **Accounts**, signed in with an email code.
2. **Everything the app saves locally today** (likes, saves, comments) **belongs to your account** and syncs
   across devices.
3. **Friends**: mutual, by request and accept.
4. **Comments on posts are visible to all your friends.**
5. **A library** (name still open): add verses to it and they show on your profile for friends to see.
6. **Collections**: saves can go into named collections. Likes are one built-in collection.

Not being built yet, but the design must leave room for them:

- **Bible studies**: group chats, text only.
- **Profile customisation.**

## What the owner cares about

- **Simple and maintainable** over feature-rich. No server code, no placeholders for future features.
- **Privacy.** No data mining, no analytics, no tracking. Store only what the app needs to work.
- **Signed out, the app works as it does now**, with no backend at all.
- **Android and iOS apps are coming**, so nothing here should be web-only.

## Background: the app today

`web/` is a static site with no framework, deployed as static files on Cloudflare Workers (see
`web/README.md`). Every post is one Bible verse from the BSB. The text lives in `data/bsb/<BOOK>.json` at
the repo root and is shared by every app.

Everything personal goes through **`web/js/activity.js`**, which keeps one localStorage entry,
`verse-feed:activity`:

```js
{
  liked:     { "JHN.3.16": { book: "JHN", chapter: 3, verse: 16, text: "For God so loved…", at: 1727900000000 } },
  saved:     { /* same shape as liked */ },
  comments:  [{ id, key: "JHN.3.16", book, chapter, verse, text, comment: "…", at }],
  following: ["Paul", "David"]   // Bible authors
}
```

Its functions are **synchronous** (`isLiked(key)`, `setSaved(...)`, `commentsFor(key)`, and so on) and the
rest of the UI calls them directly. `onChange(fn)` notifies views when anything changes.

## Decisions

| Decision | Why | Rejected alternatives |
| --- | --- | --- |
| **Supabase, called straight from the browser.** No server code, no Edge Functions. Postgres row-level security (RLS) decides who can see what. | Least code to maintain. The site stays static files on Cloudflare. | A Worker API in front of the database: more code, nothing gained. |
| **Sign-in is email plus a 6-digit code only.** | No passwords. The same flow works on web, Android and iOS with no deep links. No third-party sign-in means Apple doesn't require Sign in with Apple. | Google/Facebook/Apple sign-in (complexity, and Apple's rule). Magic links (unreliable inside mobile apps). |
| **A profile is only a username and a display name.** Email stays in Supabase's `auth.users` and is never shown to anyone. | Privacy. | Bios, avatars and other fields now. Add them when profile customisation is built. |
| **Usernames are `[a-z0-9_]{3,20}`.** Bible authors' handles and app route names are reserved. | User profiles live at `#/@username` and author profiles at `#/u/<handle>`, and the two must never be confused. | |
| **Friends only. Following is removed entirely**, including following Bible authors. | Following another user felt wrong to the owner, and following authors added little. | One-way follows. |
| **The feed is fully random, as if you followed every author**: a random chapter (all 1,189 equally likely), then a random verse in it. This is what the app does today without follows. | The owner confirmed chapter-first is right. Verses in short chapters come up more often; that's accepted. | Every verse equally likely. Every book equally likely. |
| **Friends' library items appear only on their profiles**, never in the main feed. | Keeps the feed purely Bible verses. | |
| **Collections**: one table for likes, saves and the library. Every user gets three built-ins (Likes, Saved, Library) and can make their own. | Likes and saves are the same structure already. One table instead of three. | Separate `likes`, `saves` and `reposts` tables. |
| **Visibility depends on collection type, with no setting.** Library is visible to friends. Likes, Saved and custom collections are private. | No visibility column or UI. | A private/friends switch per collection (easy to add later). |
| **Comments are visible to you and your friends.** They can be deleted but not edited, matching today's app. | No visibility column. | Per-comment visibility. |
| **A verse is identified by `(book, chapter, verse)`**, e.g. `('JHN', 3, 16)`, using the 3-letter codes in `web/js/books.js`. There is no `posts` table and no UUID per verse. | References never change, match the URLs and the local data, and are as fast to look up as a UUID. | A `verses` table with 31,102 UUID rows: joins everywhere for no gain. |
| **Verse text is not stored in the database.** The app looks it up from `data/bsb/`, as it does for posts. | The text is fixed and already bundled. Not storing it means it can't go stale and doesn't tie stored data to one translation. | Copying the text into every row, like the localStorage snapshots do. |
| **Signed-out users keep using localStorage.** The app doesn't load Supabase until someone signs in. | Signed-out behaviour stays as it is now, with no backend. | Anonymous Supabase accounts. |
| **Importing local data is done by the browser** with plain inserts, once, when you first sign in on that browser. | No server function. Phone apps don't need an import path: anyone who wants their browser data moved signs in on that browser. | An `import_local_activity` database function. |
| **Supabase Realtime and Storage aren't used yet.** | Nothing needs them until bible studies (Realtime) and avatars (Storage). | |

## Backend

All of it is in [`schema.sql`](schema.sql). In plain English:

### Tables

| Table | Holds |
| --- | --- |
| `profiles` | `id` (same as the auth user), `username`, `display_name`, `created_at` |
| `friendships` | `requester`, `addressee`, `accepted`. One row per pair, whichever way round the request went |
| `collections` | `user_id`, `kind` (`likes`, `saved`, `library` or `custom`), `name` |
| `collection_items` | `collection_id`, `book`, `chapter`, `verse`, `added_at` |
| `comments` | `user_id`, `book`, `chapter`, `verse`, `body` (1–2,000 characters), `created_at` |

### Functions and trigger

- **`is_friend(other)`**: is `other` an accepted friend of the signed-in user? It only answers about the
  caller, so nobody can use it to find out who else is friends with whom. The access rules use it.
- **A trigger on new profiles** creates that user's Likes, Saved and Library collections.
- **`delete_my_account()`**: deletes the signed-in user's account and, by cascade, everything they own.

### Access rules

Signed-out visitors get nothing from the database. For signed-in users:

| Data | Who can see it | Who can change it |
| --- | --- | --- |
| Profiles | Any signed-in user | You, your own (username and display name only) |
| Friendships | The two people involved | You send requests as yourself; only the person asked can accept; either side can delete (decline, cancel or unfriend) |
| Collections | Yours, plus your friends' Library | You create, rename and delete your own custom collections. Built-in ones can't be renamed or deleted |
| Collection items | Whenever you can see their collection | You add and remove items in your own collections |
| Comments | Yours and your friends' | You add and delete your own. No editing |

Column-level grants back these up: for example, you can update a friendship's `accepted` column but never
its `requester` or `addressee`, so a request can't be rewritten to come from someone else.

**One trade-off accepted:** any signed-in user can list every username and display name through the API.
Stopping that needs a server-side exact-username lookup. Profiles hold nothing else, so it wasn't worth it.

### What "comments visible to friends" means

If Alice and Bob are both your friends but not each other's, you see both their comments on John 3:16.
Alice sees her own and yours, not Bob's. Unfriending someone hides their comments from you and yours from
them.

### Tests

`tests/run.sh` creates a throwaway database on a local Postgres, loads a small stand-in for the parts of
Supabase the schema uses (`tests/supabase-stub.sql`: the `anon` and `authenticated` roles, `auth.users`
and `auth.uid()`), runs `schema.sql`, then runs `tests/access-rules.sql`. That file signs in as three
users (Alice and Bob become friends; Carol has no friends) and checks 35 rules, such as "a friend sees
only your Library" and "the requester can't accept their own request". All pass on Postgres 16.

The stand-in is not Supabase, so this proves the rules' logic, not the Supabase specifics. See
[Things to verify](#things-to-verify).

## Changes to the web app

### Loading Supabase

- **Bundle a pinned copy of `supabase-js` with the site** rather than loading it from a third-party CDN, so
  no outside service sees visitors' requests. There's no bundler, so `scripts/build.mjs` would copy the
  library's prebuilt browser file from `node_modules` into `dist/`.
- **The project URL and public key go in a committed `web/js/config.js`.** They're public by design (RLS
  protects the data), so they don't need to be secret build variables. `web/README.md` currently says
  "no environment variables or API keys are needed"; update it.
- **Signed out, the app never loads `supabase-js` and makes no requests to Supabase.** On startup it checks
  whether a Supabase session is saved in localStorage (the `sb-<project>-auth-token` key) and only loads
  the library if one is.

### `activity.js`: two stores behind one interface

Keep the module's public functions, and keep them synchronous so the views barely change:

- **Signed out**: localStorage, as now, in the new format below.
- **Signed in**: when the app starts, load the user's own data in a few queries (their collections,
  collection items and comments; this is small) into the same in-memory state. Reads come from memory.
  Writes update memory straight away, call `onChange`, then send the change to Supabase. If the request
  fails, undo the change in memory and show a toast.
- **New async functions** for other people's data: friends' comments on a post, a friend's profile and
  library, friend requests.

New localStorage format (version 2). Old data under `verse-feed:activity` is converted the first time the
new code runs: `liked` becomes the Likes collection, `saved` becomes Saved, `text` snapshots and
`following` are dropped.

```js
{
  version: 2,
  collections: [
    { id: "likes", kind: "likes", name: "Likes", items: [{ book: "JHN", chapter: 3, verse: 16, at }] },
    { id: "saved", kind: "saved", name: "Saved", items: [] },
    { id: "k3x9",  kind: "custom", name: "Psalms I love", items: [] }
  ],
  comments: [{ id, book, chapter, verse, comment, at }],
  importedAt: null   // set once this browser's data has been added to an account
}
```

There's no Library while signed out, because it exists to be seen by friends. The library button prompts
you to sign in.

### Verse text in grids

Grids (Likes, a collection, a friend's library) get references without text. Load each distinct book once
with `getChapter` from `bible.js`, which uses the bundled `data/bsb/` files and caches them, then draw the
tiles.

### Feed and following (`app.js`, `profile.js`, `account.js`, `books.js`)

- `app.js`: `pickChapter()` becomes `randomChapter()`. Stories show every author in a fixed order.
- `profile.js`: remove the Follow button on author profiles.
- `account.js`: remove the "Following" section.
- `books.js`: `randomFromWorks` stays, because author profiles use it for their grids.

### Posts (`post.js`)

- **Heart / double-tap** adds to Likes.
- **Bookmark tap** adds to Saved. **Press and hold** opens a sheet to choose a collection or make a new one.
- **A new library button** adds to Library (signed in only).
- **The comments sheet** shows the commentary summaries, then comments from you and your friends with
  their display names. Signed out, it shows only your local comments, as now.

### Routes

| Route | View |
| --- | --- |
| `#/u/<handle>` | A Bible author's profile (unchanged) |
| `#/@<username>` | A user's profile: display name, username and Library. Friends only; others see the name and an "Add friend" button |
| `#/me[/tab]` | Your own private view: Likes, Saved, your collections, comments, friends and friend requests |
| `#/signin` | Email, then code, then (first time) username and display name |

### Sign-in flow

1. Enter your email. Call `supabase.auth.signInWithOtp({ email })`, which creates the account if it's new.
2. Type the 6-digit code from the email. Call `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
3. If you have no row in `profiles` yet, choose a username and display name and insert one. The trigger
   creates your collections.
4. If this browser has local data that hasn't been imported, offer to import it.

Settings gets **Sign out** and **Delete account** (`rpc('delete_my_account')`, then sign out).

### Importing local data

On first sign-in on a browser with local data, show a prompt like: "This browser has 30 likes, 12 saves
and 4 comments. Add them to your account? Your comments will be visible to your friends." Comments have a
checkbox so they can be left out. Steps:

1. Create any custom collections that don't exist yet (matched by name).
2. Insert all collection items in one request, ignoring duplicates (`upsert` with `ignoreDuplicates`), so
   running it twice is harmless.
3. Insert the comments in one request. One request is one statement, so it either fully succeeds or fully
   fails.
4. Set `importedAt` locally. After that, this browser reads from the account while signed in.

Settings also has an "Import from this browser" button for anyone who dismissed the prompt.

### Friends

- **Add a friend** by typing their exact username.
- **Requests** (incoming and sent) are listed in `#/me`, with Accept, Decline and Cancel.
- If you try to send a request to someone who has already sent you one, the database refuses it (one row
  per pair). The app should show their request so you can accept it instead.

## Setting up Supabase

1. **Create a Supabase project.** One project to start; previews and production can share it at first.
2. **Commit the schema as a migration**: `supabase init` at the repo root, then put `schema.sql` in
   `supabase/migrations/`. Apply it with `supabase db push`. The `tests/` folder can move to `supabase/tests/`.
3. **Auth settings**: email sign-in on, with sign-in by code. Turn off every other provider. Change the email
   templates to show `{{ .Token }}` (the code) instead of a link. Keep the code length at 6.
4. **Email sending**: Supabase's built-in email is for testing and only sends a few emails an hour.
   Connect a transactional email service through Supabase's SMTP settings before launch. Postmark or
   Amazon SES are options; pick one whose privacy terms you're comfortable with, since it sees email
   addresses.
5. **Privacy policy**: say what's stored (email, username, display name, likes, saves, comments,
   friendships) and that Supabase keeps sign-in IP addresses in its auth logs.

## Android and iOS

The plan is to wrap the web app with **Capacitor**. Everything above carries over:

- `supabase-js` and the access rules don't change. A native rewrite later could use Supabase's SDKs for
  Swift, Kotlin, Flutter or React Native against the same database.
- Email-plus-code sign-in needs no deep links or app-specific setup.
- With no Google, Facebook or Apple sign-in, Apple doesn't require Sign in with Apple.
- **Signed-out data on phones**: iOS can clear a web view's localStorage, so the signed-out store should use
  Capacitor Preferences in the apps.
- The apps have no import path. Anyone who wants browser data moved signs in on that browser first.

## Leaving room for later features

Nothing is built or reserved for these now. The point is that neither needs existing tables reworked.

**Bible studies** (group chats, text only) would add three tables, following the friendships pattern:

```sql
studies        (id, name, created_by, created_at)
study_members  (study_id, user_id, role, joined_at)
study_messages (id, study_id, user_id, body text not null, created_at)  -- text only: no attachment column
```

…plus an `is_member(study_id)` function built like `is_friend`, and Supabase Realtime for live messages.
A verse shared into a study would use the same `(book, chapter, verse)` reference.

**Profile customisation** adds columns to `profiles` (and a Storage bucket if avatars are uploaded) in a new
migration.

**Posts that aren't a single verse** (for example a passage like Psalm 23:1–3): add a nullable `verse_end`
column. If posts ever stop being Bible text, add a `posts` table then.

## Things to verify

These are Supabase specifics the local tests can't cover:

1. **`delete_my_account()`**: does a `security definer` function owned by the `postgres` role have
   permission to delete from `auth.users` on a hosted project? If not, the alternative is an Edge Function
   using the admin API. That would be the only server code.
2. **Email templates for codes**: which templates need `{{ .Token }}`? Probably both "Magic Link" (existing
   users) and "Confirm signup" (new users). Is the code length still 6 by default?
3. **API keys**: Supabase has been moving from the `anon` key to "publishable" keys (`sb_publishable_…`).
   Use whichever new projects get, and confirm it maps to the `anon` role.
4. **Default grants**: the schema assumes new tables in `public` are granted to `anon` and `authenticated`,
   and then revokes what it doesn't want. Check this matches a new project.
5. **Self-hosting `supabase-js`**: the file name and path of its prebuilt browser bundle in `node_modules`.
6. **Session key**: the exact localStorage key `supabase-js` uses for the session, so the app can detect a
   signed-in user without loading the library.
7. **Rate limits on code emails**: the defaults, and whether a captcha is needed before launch.

## Open questions for the owner

1. **The library's name.** Your shortlist: "Add to library", "Collect" (likely confused with collections),
   "Shelve". Suggested: **Treasure** ("Where your treasure is…", Matthew 6:21; "Mary treasured up all these
   things", Luke 2:19). Other ideas: Hide in my heart (Psalm 119:11), Highlight (clashes with the
   carousel's verse highlight), Underline, Mark, Keep, Cherish. In the schema the collection kind is
   `library` whatever the button says.
2. **Who can see a profile**: should non-friends see your display name and an "Add friend" button (as
   planned), or nothing until you're friends?
3. **Reserved usernames** include common first names that are also Bible authors (`john`, `paul`,
   `mark`, `james`, `peter`, ...). So a real person called John can't be `@john`. Is that OK?
