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
- **Follow**: authors you follow appear first in the stories row and make up about half of your feed.
- **Search**: jump to a reference (`John 3:16`, `ps 23`, `1 cor 13 4`), a book or an author.
- **Your activity** (top-right button): the posts you've saved, liked and commented on, and who you follow.
- **Comments**: add your own comments to any post, alongside the commentary summaries.
- Double-tap to like, share/copy, infinite scroll, light/dark mode.

Likes, saves, comments and follows are stored in the browser (localStorage). There are no accounts yet, so
they don't sync between devices.

## Where the text comes from

The whole BSB is committed to the repo as one JSON file per book in `data/bsb/` (about 4 MB), so builds
don't need the network. `npm run fetch-bible` downloads it again from the
[Free Use Bible API](https://bible.helloao.org); you only need that to refresh the text. `npm run build` copies
the site and those files into `dist/`. The app loads a book's file the first time it needs it, and fetches any
chapter that isn't there live from the same API. Commentaries are always fetched live.

## Run locally

```sh
cd web
npm start              # serves the source
npm run build && npm run preview   # serves the built dist/
```

## Deploy on Cloudflare

In the Cloudflare dashboard: **Workers & Pages → Create application → Connect GitHub**, pick this repo, then:

| Setting | Value |
| --- | --- |
| Project name | `bibliofeed` (must match `name` in `wrangler.jsonc`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Advanced settings → Path | `web` |

`wrangler.jsonc` tells Cloudflare to serve only `dist/` as static files. There's no server code, and no
environment variables or API keys are needed. Every push to `main` redeploys the live site.

**Preview builds:** in **Settings → Build → Previews Base**, turn on *Builds for Preview branches* with the same
build command and root directory. Every push to another branch then gets its own preview link.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Layout and styling |
| `js/app.js` | Feed, stories row and routing between views |
| `js/post.js` | A post: carousel, likes, saves, comments sheet, single-post view |
| `js/profile.js`, `js/account.js`, `js/search.js` | The profile, your-activity and search views |
| `js/activity.js` | Your likes, saves, comments and follows (localStorage) |
| `js/ui.js` | Shared helpers: icons, avatars, tiles, toasts, sheets |
| `js/bible.js` | Loads chapters (bundled file → live API fallback) |
| `js/commentary.js` | Commentary summaries and study links |
| `js/books.js` | The 66 books: codes, chapter counts, authors, bios |
| `data/bsb/` | The BSB text, one JSON file per book |
| `scripts/fetch-bible.mjs` | Downloads the BSB into `data/bsb/` |
| `scripts/build.mjs` | Builds `dist/` from the source and `data/bsb/` |
| `server.js` | Zero-dependency static server for local development |
| `wrangler.jsonc` | Cloudflare config: serve `dist/` as static assets |

## Ideas for later

- Better summaries (for example, probably don't want an LLM summarising the full commentary text though).
- Make it installable on phones and work offline (bubblewrap or native app or something else)
