# bibliofeed

A photo-feed style app where every post is a random Bible verse.

| Folder | What it is |
| --- | --- |
| [`web/`](web/) | The web app (static site deployed on Cloudflare Workers). See [`web/README.md`](web/README.md). |
| `data/bsb/` | The Berean Standard Bible, one JSON file per book. Shared by every app. |

## The Bible text

`data/bsb/` holds the whole BSB as `<BOOK>.json`, about 4 MB, committed so that builds need no network.
Each file is `[[ [verse, text], ... ], ...]` indexed by chapter - 1. The text is public domain and fixed,
so these files should not need to change.

To download it again (only needed to refresh the text):

```sh
cd web && npm run fetch-bible
```

That script lives in `web/scripts/` because it reuses the app's book list and API parser. It writes to
`data/bsb/` at the repo root, and refuses to write anything if any chapter fails.
