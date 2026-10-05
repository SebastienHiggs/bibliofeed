# Plan: accounts and friends with a Supabase backend

Status: **proposal, revised after review (4 Oct 2026)**. Nothing in `web/` has changed yet.
[Changes since the first draft](#changes-since-the-first-draft) lists what the review changed.

This folder holds:

| File | What it is |
| --- | --- |
| `README.md` | This plan: what we're building, the decisions behind it, and how the app changes |
| [`supabase/migrations/20261004120000_init.sql`](../../supabase/migrations/20261004120000_init.sql) | The whole backend: 5 tables, 4 functions, 1 trigger, the grants and the access rules |
| [`supabase/tests/`](../../supabase/tests/) | Checks that the access rules do what this plan says, and a probe that times the app's queries with 100,000 users. `run.sh` runs them on the local Supabase stack or a plain Postgres |
| [`supabase/config.toml`](../../supabase/config.toml) | The local stack's settings. Realtime, Storage, Edge Functions and analytics are off because nothing uses them |

## Target

**Stable at about 1,000,000 users, each commenting roughly once a week.** That is:

| | |
| --- | --- |
| Comments written | ~1.7 a second on average, ~52 million a year |
| Comments on the single most popular verse | roughly 1 million a year, if it takes 2% of all comments |
| Friendships | ~10–25 million rows (20–50 friends each) |
| Collection items | ~200 million rows at 200 likes and saves per user |

The write rate is trivial for Postgres. What matters is that **every query the app makes costs in proportion
to one user's own data and friends, never to the size of the user base or the popularity of a verse.** The
access rules and indexes below are arranged for that, and `supabase/tests/scale.sql` checks it.

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

- **Simple and maintainable** over feature-rich. No server code (the one exception, since 5 Oct 2026, is
  `web/redirect.js`: a hostname check that sends the old `workers.dev` address to bibliofeed.net), no
  placeholders for future features.
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
| **Usernames are `[a-z0-9_]{3,20}`.** Reserved: the app's routes and words, names people would assume are the site or its staff, technical words, names whose use would be impersonation or in poor taste (about 200, in `supabase/migrations/20261005120000_reserved_usernames.sql`), and the 37 Bible author handles (`…130000_reserve_author_names.sql`). | So a comment can't look as if it came from Paul. The author list is a copy of `handle()` over `books.js`; the test runner fails if the two drift apart. | Leaving authors available (a real John as `@john`): the owner first chose this, then reversed it on 5 Oct 2026. |
| **Friends only. Following is removed entirely**, including following Bible authors. | Following another user felt wrong to the owner, and following authors added little. | One-way follows. |
| **The feed is fully random, as if you followed every author**: a random chapter (all 1,189 equally likely), then a random verse in it. This is what the app does today without follows. | The owner confirmed chapter-first is right. Verses in short chapters come up more often; that's accepted. | Every verse equally likely. Every book equally likely. |
| **Friends' library items appear only on their profiles**, never in the main feed. | Keeps the feed purely Bible verses. | |
| **Collections**: one table for likes, saves and the library. Every user gets three built-ins (Likes, Saved, Library) and can make their own. | Likes and saves are the same structure already. One table instead of three. | Separate `likes`, `saves` and `reposts` tables. |
| **Visibility depends on collection type, with no setting.** Library is visible to friends. Likes, Saved and custom collections are private. | No visibility column or UI. | A private/friends switch per collection (easy to add later). |
| **Comments are visible to you and your friends.** They can be deleted but not edited, matching today's app. | No visibility column. | Per-comment visibility. |
| **A comment is stored against a verse but shown chapter-wide.** The comments sheet on any post lists the whole chapter's comments from you and your friends: those on this verse first, then "Elsewhere in Ezra 5", each tagged "v. 10". | The feed is random over 31,102 verses, so a comment pinned to one verse was almost never met again; a chapter comes round about 26 times more often. The query is a prefix of the comments index, so nothing in the schema changes. | Making the chapter the unit of comments (verse optional): one small migration later if people want to comment on a chapter as a whole. Comments at chapter level for likes and saves too: no, the thing you like is the verse. |
| **A verse is identified by `(book, chapter, verse)`**, e.g. `('JHN', 3, 16)`, using the 3-letter codes in `web/js/books.js`. There is no `posts` table and no UUID per verse. | References never change, match the URLs and the local data, and are as fast to look up as a UUID. | A `verses` table with 31,102 UUID rows: joins everywhere for no gain. |
| **Verse text is not stored in the database.** The app looks it up from `data/bsb/`, as it does for posts. | The text is fixed and already bundled. Not storing it means it can't go stale and doesn't tie stored data to one translation. | Copying the text into every row, like the localStorage snapshots do. |
| **Access rules never call a function per row.** "Is this a friend's?" is written as `user_id in (select friend_ids())`, which Postgres evaluates once per statement. Items check only their own collection. | At a million users the first draft's `is_friend(user_id)` per row and `collection_id in (select id from collections)` would have scanned every library in the system on every query. | A denormalised `user_id` on `collection_items`: faster still, but a second copy of ownership to keep right. |
| **The app always asks for comments by named people** (itself and its friends), never "all comments on this verse". | Only then is the cost proportional to your friend count. Measured: ~1 ms versus ~280 ms with 52,000 comments on one verse. | An index on the verse alone, which would still read every comment on it. |
| **Grants are spelled out in full**, not left to the project's defaults. | The schema stands on its own and can be read without knowing Supabase's defaults. | Revoking from the defaults, as the first draft did. |
| **Signed-out users keep using localStorage.** The app doesn't load Supabase until someone signs in. | Signed-out behaviour stays as it is now, with no backend. | Anonymous Supabase accounts. |
| **Importing local data is done by the browser** with plain inserts, once, when you first sign in on that browser. | No server function. Phone apps don't need an import path: anyone who wants their browser data moved signs in on that browser. | An `import_local_activity` database function. |
| **Supabase Realtime and Storage aren't used yet.** | Nothing needs them until bible studies (Realtime) and avatars (Storage). | |

## Backend

All of it is in the first migration, [`20261004120000_init.sql`](../../supabase/migrations/20261004120000_init.sql).
In plain English:

### Tables

| Table | Holds |
| --- | --- |
| `profiles` | `id` (same as the auth user), `username`, `display_name`, `created_at` |
| `friendships` | `requester`, `addressee`, `accepted`. One row per pair, whichever way round the request went |
| `collections` | `user_id`, `kind` (`likes`, `saved`, `library` or `custom`), `name` |
| `collection_items` | `collection_id`, `book`, `chapter`, `verse`, `added_at` |
| `comments` | `user_id`, `book`, `chapter`, `verse`, `body` (1–2,000 characters), `created_at` |

Indexes, beyond primary keys and the unique username: trigram (GiST) indexes on username and display name
for the people search (the `pg_trgm` extension, which Supabase ships); friendships by addressee and by pair;
collections by user, and by `(user, kind)` for the built-ins; comments by `(user, book, chapter, verse)`.
That last one is the only index comments need, because both queries the app makes ("comments by these
people on this verse" and "all my comments") are prefix lookups on it.

### Functions and trigger

- **`friend_ids()`**: the signed-in user's accepted friends. It runs as the caller, so it can only read the
  friendship rows the caller may see anyway. The access rules use it, and the app can call it too
  (`rpc('friend_ids')`) to get the ids it needs for comment queries.
- **`search_profiles(q)`**: the 20 people whose username or display name best matches `q`, by trigram word
  similarity, so "seb" finds "Sebastien Higgs" and a small typo still matches. It exists because a plain
  `ilike` search has a cliff: a term that matches almost nobody makes Postgres read the whole table
  (measured: 200 ms at 100,000 users, so seconds at a million). The function instead takes the 20 nearest
  names from each index and stops, whatever the term.
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
its `requester` or `addressee`, so a request can't be rewritten to come from someone else. Tables with
nothing to edit (items, comments) have no update grant at all.

**One trade-off accepted:** any signed-in user can search and page through every username and display
name. That is the people search working as intended, and at a million users it is also a scrapeable
directory, though one that holds nothing but chosen names. Limiting it later (exact-username lookup only,
profiles readable by friends only) is a one-migration change.

**Known gap, accepted for now:** nothing limits how many friend requests one account can send, and a
declined requester can ask again straight away. If this is abused, the fix is a `blocked` state on
friendships (the `accepted` flag becomes a status column) and a cap on pending requests, in one migration.

### What "comments visible to friends" means

If Alice and Bob are both your friends but not each other's, you see both their comments on John 3:16.
Alice sees her own and yours, not Bob's. Unfriending someone hides their comments from you and yours from
them.

### Tests

`supabase/tests/run.sh` resets the local Supabase stack's database (which applies every migration) and
runs `access-rules.sql` against it. That file signs in as three users (Alice and Bob become friends; Carol
has no friends) and checks 43 rules, such as "a friend sees only your Library", "you can't comment as
someone else" and "the requester can't accept their own request". **All 43 pass on the real stack
(Supabase's Postgres 17.11)**, including deleting an account through `delete_my_account()`.

`run.sh --plain` runs the same checks in seconds on any plain Postgres (14+) instead, with
`supabase-stub.sql` standing in for the `anon` and `authenticated` roles, `auth.users`, `auth.uid()` and
the `extensions` schema. That proves the rules' logic but not the Supabase specifics.

`SCALE=1 run.sh` (either mode) also runs `scale.sql`: 100,000 users with 20 friends, 30 likes, 10 library
items and 26 comments each (2 million friendships, 4 million items, 2.6 million comments, 52,000 of them on
John 3:16), then times each query the app makes as one of those users. On a laptop:

| Query | Time |
| --- | --- |
| Comments on John 3:16 by me and my friends | ~1 ms |
| The same without naming the people (what the app must never do) | ~280 ms |
| All my comments, my collections, a page of my Likes, a friend's Library, my friendships with profiles, a profile by username | each under 0.5 ms |
| People search, whether the term matches a few hundred people, everyone or nobody | 25–35 ms |
| Inserting a like, inserting a comment | each under 0.5 ms |

Every figure depends on the user's own data and friend count, not the number of users, so the same shape
holds at a million. Rerun it after changing any policy or index. (Measured on plain Postgres 16.)

The browser tests in `web/e2e/` exercise the app against this schema end to end; see `web/README.md`.

### Testing backend changes locally

Supabase's hosted branching is a paid feature, so every change is tried on a local copy first. The local
stack is set up (`supabase/config.toml`); it needs Docker and uses `npx supabase`, so nothing else is
installed.

1. `npx supabase start` at the repo root runs the stack: Postgres with the real `auth` schema and roles,
   the API, auth, Studio at `http://127.0.0.1:54343` and a mail catcher at `http://127.0.0.1:54344` where
   sign-in codes arrive. Ports are 5434x so it runs beside other local Supabase projects.
2. `npx supabase db reset` wipes the local database and applies every file in `supabase/migrations/`.
3. `supabase/tests/run.sh` does that and runs the checks (and `scale.sql` with `SCALE=1`).
4. Point the web app at the local stack while developing: `npx supabase status` prints the local URL and
   publishable key, which go in an uncommitted `web/js/config.local.js` that overrides `config.js`. The
   local keys are the same for everyone and protect nothing.
5. A schema change is a new file in `supabase/migrations/` (`npx supabase migration new <name>`), reviewed
   in a pull request. `supabase db push` applies it to the hosted project, and only from `main`.

Contributors do the same with their own local stack. Nothing they run touches the hosted database.

## Changes to the web app

### Loading Supabase

- **Bundle a pinned copy of `supabase-js` with the site** rather than loading it from a third-party CDN, so
  no outside service sees visitors' requests. There's no bundler, so `scripts/build.mjs` would copy the
  library's prebuilt browser file (`dist/umd/supabase.js` in the package) from `node_modules` into `dist/`.
- **The project URL and public key go in a committed `web/js/config.js`.** They're public by design (RLS
  protects the data), so they don't need to be secret build variables. `web/README.md` currently says
  "no environment variables or API keys are needed"; update it.
- **Signed out, the app never loads `supabase-js` and makes no requests to Supabase.** The app keeps its own
  `bibliofeed:signedIn` flag in localStorage, set at sign-in and cleared at sign-out, and only loads the
  library when it's set. (Don't read `supabase-js`'s own storage key for this; its name is an internal
  detail.)

### `activity.js`: two stores behind one interface

Keep the module's public functions, and keep them synchronous so the views barely change:

- **Signed out**: localStorage, as now, in the new format below.
- **Signed in**: when the app starts, load the user's own data into the same in-memory state: collections,
  friendships (with the friends' profiles), and the items and comments. Reads come from memory. Writes
  update memory straight away, call `onChange`, then send the change to Supabase. If the request fails, undo
  the change in memory and show a toast.
- **Page every list.** Supabase returns at most 1,000 rows per request by default and says nothing when it
  cuts a result short. Load items per collection and comments per user with `.range()`, newest first, until
  a page comes back short. Heavy users will have more than 1,000 likes.
- **New async functions** for other people's data: friends' comments on a post, a friend's profile and
  library, friend requests.
- **Comments on a post** are always requested as "comments on this verse by these users": the signed-in
  user plus the friend ids already in memory, with `select=*,profiles(display_name)` to get names in the
  same request. Never request a verse's comments without the user filter (see [Target](#target)).
- **Generate ids in the browser** (`crypto.randomUUID()`) for comments and custom collections, so the
  in-memory state and the database agree without a round trip.

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
- **A new "Add to Library" button** adds to Library (signed in only). In the schema the kind is `library`.
- **The comments sheet** has two panes, swiped or tapped between: **Commentary** first (the exegesis,
  by the owner's decision), then **Comments**, holding "On 5:10" and "Elsewhere in Ezra 5" (tagged with
  the verse; tapping the tag opens that verse's own post). Every list is capped at three with a
  "Show more", so nothing is unbounded. The tab reads "Comments (N)" and the line under each post reads
  "View commentary · N comments", counting the whole chapter, so people's comments are noticed without
  scrolling past the commentaries. Friends' comments join these lists in the friends step; the queries
  always name the people (see [Target](#target)). Signed out, it shows only your local comments.

### Routes

| Route | View |
| --- | --- |
| `#/u/<handle>` | A Bible author's profile (unchanged) |
| `#/@<username>` | A user's profile: display name, username, the friend button and, for friends, their Library |
| `#/me[/tab]` | Your own private view: Saved (with Library and your collections as chips, Library first), Likes, comments, friends and friend requests. The top-bar account button becomes a gear here and opens the account menu (sign in or out, import, delete). The space where counts sat is kept empty for a later reading-streak feature |
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
   running it twice is harmless. Pass the original `at` as `added_at` so order is kept.
3. Insert the comments in one request, with their original `at` as `created_at`. One request is one
   statement, so it either fully succeeds or fully fails.
4. Set `importedAt` locally. After that, this browser reads from the account while signed in.

Settings also has an "Import from this browser" button for anyone who dismissed the prompt.

### Search (`search.js`)

Search gets a second field, **People**, next to the existing verse/book/author search. It is signed-in
only. From 2 characters, debounced, it calls `rpc('search_profiles', { q })` and shows display name and
username for up to 20 people; tapping a result opens `#/@username`. The match is fuzzy by design: it finds
a word in either name that starts like, or is close to, what was typed. Exact usernames always match. See
[Tests](#tests) for the timings.

### Friends

Friendships are made from the other person's profile. Its one button shows the state of the pair and
changes it:

| State | Button | Pressing it |
| --- | --- | --- |
| No row | **Add friend** | Inserts a request from you |
| You asked, not yet accepted | **Requested** | Cancels the request (deletes the row) |
| They asked you | **Accept** | Sets `accepted` to true |
| Accepted | **Friends** | Removes the friend (deletes the row), after a confirmation |

- **Requests** (incoming and sent) are also listed in `#/me`, with Accept, Decline and Cancel.
- The database keeps one row per pair, so a request to someone who has already asked you is refused;
  the app shows the Accept state instead.

## Setting up Supabase

1. **Create a Supabase project.** One project to start; previews and production can share it at first.
2. **Link the repo to it and apply the migration**: `supabase link --project-ref <ref>` then
   `supabase db push`, from `main`. (The schema has lived in `supabase/migrations/` since 4 Oct 2026.)
3. **Auth settings**: email sign-in on, with sign-in by code. Turn off every other provider. Change the
   "Magic Link" and "Confirm signup" email templates to show `{{ .Token }}` (the code) instead of a link;
   `supabase/templates/code.html` is the local stack's version and can be pasted in. (Confirmed locally:
   without this change the email carries a link and no code.) Keep the code length at 6 and shorten its
   lifetime from the default hour to 10 minutes.
4. **Email sending**: Supabase's built-in email is for testing and sends only a couple of emails an hour.
   Connect a transactional email service through Supabase's SMTP settings before launch. Postmark or
   Amazon SES are options; pick one whose privacy terms you're comfortable with, since it sees email
   addresses. At a million users expect tens of thousands of sign-in emails a day.
5. **Bot protection**: turn on Supabase's captcha with Cloudflare Turnstile (privacy-friendly, no puzzles
   for most people) on the sign-in form, so the email endpoint can't be used to spam addresses. Built on
   5 Oct 2026: `web/js/captcha.js` renders the widget (invisible unless Cloudflare needs a tap) and the
   token goes with `signInWithOtp`; `[remotes.production.auth.captcha]` in `config.toml` turns the check
   on for the hosted project with the secret from the `TURNSTILE_SECRET_KEY` environment variable. The
   site key goes in `web/js/config.js`; locally the check is off (see the comment in `config.toml` for
   trying it with Turnstile's test keys).
6. **Compute**: start on the Pro plan's default instance. Nothing here is CPU-heavy, but a few hundred
   million `collection_items` rows need disk, and the connection pooler should be on for the apps. Watch
   the dashboard's slow-query report; any query over a few milliseconds means a policy or index changed.
7. **Privacy policy**: say what's stored (email, username, display name, likes, saves, comments,
   friendships) and that Supabase keeps sign-in IP addresses in its auth logs.

## Open source and the site

The site is at **bibliofeed.net**, and the repository is to become public.

- **The data stays with the owner.** The hosted Supabase project is the owner's; contributors run a local
  stack (above) and never touch it. The project URL and public key in `web/js/config.js` are safe to
  publish: RLS is the protection, not the key.
- **Pull requests only into `main`, always reviewed by the owner.** `.github/CODEOWNERS` names the owner for
  every file, and `.github/main-ruleset.json` is the GitHub rule for `main`: no direct pushes or force
  pushes, one approving review that must come from a code owner, stale approvals dismissed on new pushes.
  The owner can merge their own pull requests without a second reviewer; nobody else can. GitHub only
  enforces rules on public repositories (or with a Pro plan), so apply it when the repository goes public:

  ```sh
  gh api repos/SebastienHiggs/bibliofeed/rulesets --input .github/main-ruleset.json
  ```

- **Two pages**, static files in `web/` (done 5 Oct 2026): `/about` (what the site is, where the text comes
  from, what is stored about you and which services see what) and `/contributing` (how to run the app and
  the local Supabase stack, the tests, how changes are reviewed). Both are linked from the account menu.
  Changes to what is stored about people must update the about page too.
- **A licence** for the code (MIT, `LICENSE`, done 5 Oct 2026), and a `CONTRIBUTING.md` that points at
  `/contributing`. The Bible text is the public-domain BSB and needs no licence.

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

…plus a `my_study_ids()` function built like `friend_ids`, used as `study_id in (select my_study_ids())`,
and Supabase Realtime for live messages. A verse shared into a study would use the same
`(book, chapter, verse)` reference.

**Profile customisation** adds columns to `profiles` (and a Storage bucket if avatars are uploaded) in a new
migration.

**Blocking** turns `friendships.accepted` into a status column (`pending`, `accepted`, `blocked`) in one
migration; the policies change in the same file.

**Posts that aren't a single verse** (for example a passage like Psalm 23:1–3): add a nullable `verse_end`
column. If posts ever stop being Bible text, add a `posts` table then.

**Beyond a few years of comments**: at 52 million rows a year the comments table passes a few hundred
million rows eventually. With only the one index and all queries keyed by user, that's still fine; if it
ever isn't, partition `comments` by `created_at` year. Nothing in the app would notice.

## Things to verify

These are specifics of the hosted service that the local stack can't cover. (The local stack has settled
two: `delete_my_account()` deletes from `auth.users` as intended, and new projects issue
`sb_publishable_…` keys, which the local stack prints alongside the legacy anon key.)

1. **`delete_my_account()` on the hosted project**: the local stack says yes; confirm once on the hosted
   one, since role privileges there could differ. If it fails, the alternative is an Edge Function using
   the admin API. That would be the only server code.
2. **Rate limits on code emails**: the defaults with custom SMTP. (The Turnstile setup was verified on
   the local stack on 5 Oct 2026, below; what's left is creating the widget and pushing the secret.)

## Decisions taken by the owner, 4 Oct 2026

1. **The library button says "Add to Library".** (Alternatives considered: Collect, Shelve, Treasure.)
2. **Profiles are visible to every signed-in user**, with the friend button on them, and people are found
   through the search view by username or display name.
3. **Bible author names are reserved** as usernames (decided 5 Oct 2026, reversing the first decision).

## Changes since the first draft

From the review of 3–4 Oct 2026, with a target of a million users:

- **Access rules rewritten for scale.** `is_friend(other)` (called once per row) became `friend_ids()`
  (evaluated once per statement, and no longer `security definer`). Item policies check only the row's own
  collection. `auth.uid()` is wrapped as `(select auth.uid())` throughout. Measured against 100,000 users;
  see [Tests](#tests).
- **Comments index** changed to `(user_id, book, chapter, verse)`, replacing the verse-only and user-only
  indexes, and the app is required to always name the users whose comments it wants.
- **Grants spelled out** instead of revoking from project defaults. One "thing to verify" removed.
- **Reserved usernames** went from six words to about 200, and on 5 Oct the owner reversed the earlier
  call and reserved the 37 Bible author handles too; the test runner checks that list against `books.js`.
- **People search** added (`search_profiles()` over trigram indexes) and the **friend button's four
  states** specified, at the owner's request.
- **Open source**: how contributors test locally, the `main` branch rule, and the about and contributing
  pages for bibliofeed.net.
- **Session detection** uses the app's own flag, not `supabase-js`'s internal storage key.
- **Paging** of items and comments, **client-generated ids**, and keeping original timestamps on import,
  added to the front-end plan.
- **Setup**: migrations from day one, tests on `supabase start`, Turnstile, shorter code lifetime, compute
  notes.
- **Tests**: 8 more rule checks (43), a scale probe (`scale.sql`), and a `.gitattributes` so `run.sh`
  keeps LF line endings on Windows checkouts.
- **Build step 1 done (4 Oct 2026)**: `supabase init`, the schema moved to `supabase/migrations/`, the tests
  to `supabase/tests/`, and the local stack configured and used to run them.
- **Build step 2 done (4 Oct 2026)**: `web/js/backend.js` and `config.js`, the bundled supabase-js, the
  `#/signin` flow (email, code, first-time username and display name), and Settings with sign out and
  delete account. Walked through end to end against the local stack, including a taken username, a
  returning user skipping the profile step, the session surviving a reload, and deletion cascading.
- **Build step 3 done (4 Oct 2026)**: following removed; `activity.js` moved to the collections format
  (version 2, with the one-time upgrade of old data) and became two stores behind one interface. Verified
  against the local stack: likes, saves and comments written while signed in appear in the database with
  client-generated ids, reload from the account, and the browser's own data returns on sign-out.
- **Comments shown chapter-wide (4 Oct 2026)**, after the owner found a comment on Ezra 5:10 impossible to
  meet again. The sheet became two panes (Commentary, Comments) with capped lists; see the decisions
  table. Verified: a comment on Deuteronomy 17:10 appears under "Elsewhere in Deuteronomy 17" when
  viewing 17:5, and its tag opens the post for that verse.
- **Friends' comments shown (4 Oct 2026)**, the first piece of the friends step. Friendships load with the
  account; a chapter's friends' comments are fetched by naming the friends (one request per chapter,
  remembered for a minute) and merged into the sheet and the preview line with display names.
- **Build step 5 done (4 Oct 2026)**: people's profiles at `#/@username` with the four-state friend
  button and a friend's Library; a Friends tab on your activity page listing requests (Accept/Decline),
  sent requests (Cancel) and friends; and the People tab in Search calling `search_profiles`. All
  exercised against the local stack with the rows checked in the database.
- **Build step 6 done (4 Oct 2026)**: the "Add to Library" button on posts; hold or right-click the
  bookmark for the collections sheet (Saved, your collections, New collection); and collection chips on
  the Saved tab (Saved, each of yours, Library) with rename and delete. Verified on the local stack.
- **Build step 4 done (4 Oct 2026), the last**: a banner on your activity page and an entry in Settings
  offer to add this browser's signed-out activity to the account, with the comments optional. Custom
  collections are matched by name or created, items are upserted (duplicates skipped) and comments get
  fresh ids; original timestamps are kept; the browser remembers it has imported (or declined). Verified
  on the local stack. **All six build steps are done**; what remains is the hosted project, the
  `config.js` values, and the open-source housekeeping listed above.
- **Browser tests (5 Oct 2026)**: seven Playwright tests in `web/e2e/` (`npm test`) against the local
  stack: sign in by code read from Mailpit's API, reload and sign out; likes, saves and comments back from
  the account after a reload; a friend request found through People search and accepted on the Friends
  tab; a friend's comment in the comments sheet; the signed-out import; a new collection; and deleting
  the account, after which the same email is asked for a username again. `.github/workflows/tests.yml`
  starts a stack on every pull request and runs them, then `supabase/tests/run.sh`. Writing them found a
  race: a new collection and the verse saved into it were sent in parallel, so the item could be refused.
  Account writes now go out one after another, in order.
- **Going public (5 Oct 2026)**: MIT `LICENSE`, `/about` and `/contributing` as static pages (served by
  `server.js` and the build like `index.html`; Cloudflare serves `about.html` at `/about` by default), links
  to both in the account menu, and a short `CONTRIBUTING.md`. Checked in the browser against the local
  stack: both pages render in light and dark mode, the menu links open them (signed out by hand, signed in
  by the first browser test), and the build copies them into `dist/`.
- **Turnstile on the sign-in form (5 Oct 2026)**: `web/js/captcha.js`, the token passed through
  `backend.requestCode`, and `[auth.captcha]` in `config.toml` (off locally, on for the hosted project
  through `[remotes.production]`, secret from the environment). Verified against the local stack with the
  check turned on and Turnstile's test keys: without a token the auth server refuses the code request
  (`captcha protection: request disallowed`); with the always-passing site key the widget stays invisible,
  the code email arrives, and "Send a new code" gets a fresh token; with the key that forces a challenge
  the checkbox appears in the form, "Send code" waits for it, and the email goes once it's ticked. With
  the check off and no site key, no Cloudflare script loads and sign-in is unchanged.
