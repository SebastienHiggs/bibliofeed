# Contributing to Bibliofeed

Thanks for looking. The guide lives on the site, so it stays next to the thing it describes:

**https://bibliofeed.net/contributing** (the same page is [`web/contributing.html`](web/contributing.html) in this repo)

In short:

- `cd web && npm install && npm start` runs the app signed out, with no backend.
- `npx supabase start` at the repo root gives you your own copy of the backend; point `web/js/config.local.js`
  at it. Contributors never touch the hosted project.
- `npm test` in `web/` runs the browser tests; `sh supabase/tests/run.sh` checks the database's access rules.
  Both run on every pull request.
- Changes go through pull requests into `main`, reviewed by the owner. Keep them small, say why, and say
  what you checked.
- The plan and decisions behind the backend are in [`docs/supabase-backend/README.md`](docs/supabase-backend/README.md);
  the app's own notes are in [`web/README.md`](web/README.md).

The code is MIT-licensed ([`LICENSE`](LICENSE)); by contributing you agree your contribution is too.
