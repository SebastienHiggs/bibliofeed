# Bibliofeed

A photo-feed style web app where every post is a random Bible verse from the public-domain
**Berean Standard Bible (BSB)**. No framework and no backend: it's static files.

This app lives in `web/` of the bibliofeed monorepo. It used to be the `bibliofeed/` folder of the home-it repo.

- **Posts**: a random chapter is chosen (every chapter is equally likely), then a random verse from it.
- **Carousel**: slide 1 is the verse; the remaining slides are the whole chapter, with the verse highlighted.
- **Comments**: short summaries of public-domain commentaries (Matthew Henry, John Gill, Adam Clarke,
  Jamieson-Fausset-Brown, Keil & Delitzsch, Tyndale Open Study Notes), each linking to the full text, plus
  links to Bible Hub, StudyLight and Enduring Word for that verse.
- **Poster**: the traditional or best-guess human author (see `js/books.js`). Each psalm uses the author in its
  heading: David, Asaph, the sons of Korah, Solomon, Moses, Ethan, or unknown. Next to the name is how many years
  ago it was written (e.g. "1966y" for Matthew), from traditional dates.
- **Profiles**: tap any author (avatar, name or story) for their profile: bio, books, chapters, roughly when
  they lived, and a grid of verses from their books, filterable by book. Tap a tile to scroll through the
  grid's posts in the same order, starting from that one.
  Profiles have shareable URLs like `#/u/paul` or `#/u/moses/EXO`.
- **Search**: jump to a reference (`John 3:16`, `ps 23`, `1 cor 13 4`), a book or an author.
- **Your activity** (top-right button): your Library (signed in), the posts you've liked and your
  collections, your comments, and your friends. Tap the heart on a post to like it; hold it (or right-click)
  to put the verse in a named collection, or make one. The Collections tab shows Liked and each collection
  as a chip, where they can be renamed and deleted.
- **Library** (signed in): the Add to Library button beside the bookmark puts a verse where your friends
  can see it, on your profile.
- **Accounts**: sign in with your email and a 6-digit code (no password), choose a username and display
  name, and sign out or delete your account from the account menu (the gear in the top bar while you're
  on your own page). Signed in, your likes, saves and comments belong
  to your account and follow you across devices. Signed out, everything still works as before, in this
  browser only, and once you sign in the app offers to add that browser's activity to your account
  (comments optional, since friends can see them).
- **Friends**: find people in Search (the People tab, by name or @username), open their profile at
  `#/@username` and tap Add friend. Once they accept, you see each other's comments on verses and each
  other's Library. Requests, sent requests and your friends are listed on your activity page.
- **Comments**: add your own comments to any post. The sheet has two panes you swipe between: Commentary
  (the summaries, first) and Comments, which shows comments on this verse and then comments elsewhere in
  the same chapter, each tagged with its verse. That way a comment on Ezra 5:10 is met from any verse of
  Ezra 5, not only when that one verse comes round. Every list shows a few entries and a Show more.
- Double-tap to like, share/copy, infinite scroll, light/dark mode. Tapping the wordmark at the top of the
  feed, or pulling down on a phone, loads a fresh feed. Horizontal rows scroll with the mouse wheel on
  desktop.

Likes, saves and comments are stored in the browser (localStorage). There are no accounts yet, so
they don't sync between devices.

## Where the text comes from

The whole BSB is committed at the repo root in [`../data/bsb/`](../data/bsb/), one JSON file per book
(about 4 MB), shared with the other apps, so builds don't need the network. `npm run fetch-bible`
downloads it again from the
[Free Use Bible API](https://bible.helloao.org); you only need that to refresh the text. `npm run build` copies
the site and those files into `dist/`. The app loads a book's file the first time it needs it, and fetches any
chapter that isn't there live from the same API. Commentaries are always fetched live.

## Run locally

```sh
cd web
npm install            # once: fetches the pinned supabase-js that the build bundles
npm start              # serves the source
npm run build && npm run preview   # serves the built dist/
```

## Tests

`npm test` in `web/` runs the browser tests in `e2e/` (Playwright, Chromium) against the local Supabase
stack: signing in with a code read from the mail catcher, likes, saves and comments coming back from the
account after a reload, a friend request and accept between two accounts, a friend's comment in the
comments sheet, importing a browser's signed-out activity, saving into a new collection, and deleting
the account. It needs the stack running (`npx supabase start` at the repo root) and `js/config.local.js`
pointing at it (above); the first run also needs `npx playwright install chromium`. The tests make their
own throwaway accounts, so they can run against a stack you also develop on. They're a safety net for
contributors, not a full test suite: the database's access rules have their own tests in
[`../supabase/tests/`](../supabase/tests/).

Both sets run on every pull request (`.github/workflows/tests.yml` starts a stack on the runner).

## Accounts and the backend

Accounts, friends and syncing use Supabase, called straight from the browser; the database's row-level
security decides who may see what. The plan and the schema are in
[`../docs/supabase-backend/`](../docs/supabase-backend/README.md) and [`../supabase/`](../supabase/).

- **`js/config.js`** holds the project URL and publishable key. Both are public by design. With both
  empty, the app has no accounts and works exactly as it did before. It also holds the Cloudflare
  Turnstile site key (public too): the sign-in form runs Turnstile's bot check and sends its token with
  the code request, so the email endpoint can't be used to spam addresses. With the site key empty, as on
  the local stack, there's no bot check and nothing loads from Cloudflare.
- **`js/backend.js`** is the only module that talks to Supabase. Signed out, the app never loads the
  Supabase library or makes a request.
- **`js/activity.js`** is one synchronous store with two homes. Signed out it's localStorage. Signed in,
  the account's collections and comments are loaded into memory at startup (in pages, since the API caps
  a response at 1,000 rows), reads come from memory, and each change is applied in memory first, then sent
  to Supabase and undone with a toast if that fails.
- **supabase-js is bundled** from `node_modules` into `dist/vendor/` by the build, so no third-party CDN
  sees visitors' requests.
- **Developing against the local stack**: `npx supabase start` at the repo root, then put the URL and key
  it prints in `js/config.local.js` (ignored by git). `npm start` serves it in place of `config.js`. Sign-in
  codes arrive in the mail catcher at `http://127.0.0.1:54344`.

## Deploy on Cloudflare

In the Cloudflare dashboard: **Workers & Pages → Create application → Connect GitHub**, pick this repo, then:

| Setting | Value |
| --- | --- |
| Project name | `bibliofeed` (must match `name` in `wrangler.jsonc`) |
| Build command | leave empty (`wrangler.jsonc` tells Wrangler to run `npm run build` before deploying) |
| Deploy command | `npx wrangler deploy` |
| Advanced settings → Path | `web` |

`wrangler.jsonc` tells Cloudflare to serve only `dist/` as static files. There's no server code and no
environment variables: the Supabase URL and key are committed in `js/config.js` (see above). Cloudflare runs
`npm install` before the build command. Every push to `main` redeploys the live site.

**Preview builds:** in **Settings → Build → Previews Base**, turn on *Builds for Preview branches* with the same
build command and root directory. Every push to another branch then gets its own preview link.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Layout and styling |
| `about.html`, `contributing.html` | The static pages at `/about` and `/contributing`, linked from the account menu |
| `js/app.js` | Feed, stories row and routing between views |
| `js/post.js` | A post: carousel, likes, saves, comments sheet, single-post view |
| `js/profile.js`, `js/account.js`, `js/search.js` | The author profile, your-activity (friends, Settings) and search views |
| `js/user.js` | Another person's profile: the friend button and, for friends, their Library |
| `js/import.js` | Offering to add this browser's signed-out activity to the account |
| `js/signin.js` | Sign in: email, the 6-digit code, then a username and display name the first time |
| `js/activity.js` | Your likes, saves, collections and comments: verse references only, in localStorage or your account |
| `js/ui.js` | Shared helpers: icons, avatars, tiles, toasts, sheets |
| `js/bible.js` | Loads chapters (bundled file → live API fallback) |
| `js/commentary.js` | Commentary summaries and study links |
| `js/books.js` | The 66 books: codes, chapter counts, authors, bios |
| `scripts/fetch-bible.mjs` | Downloads the BSB into the shared `../data/bsb/` |
| `js/backend.js`, `js/config.js` | Talking to Supabase (sign-in, your profile), and where it lives |
| `js/captcha.js` | The Turnstile bot check on the sign-in form (only when `config.js` has a site key) |
| `scripts/build.mjs` | Builds `dist/` from the source, `node_modules` (supabase-js) and `../data/bsb/` |
| `server.js` | Zero-dependency static server for local development (serves the Bible text from `../data/bsb/` too) |
| `e2e/`, `playwright.config.js` | The browser tests (`npm test`), see Tests above |
| `wrangler.jsonc` | Cloudflare config: serve `dist/` as static assets |

## Ideas for later

- Better summaries (for example, probably don't want an LLM summarising the full commentary text though).
- Make it installable on phones and work offline (bubblewrap or native app or something else)
