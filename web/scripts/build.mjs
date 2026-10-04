// Builds the site into dist/: the app's static files, the bundled supabase-js
// from node_modules (run `npm install` first), and the BSB from the repo's
// shared data/bsb/ (see scripts/fetch-bible.mjs), which the mobile apps bundle too.
//   node scripts/build.mjs
// Books missing from data/bsb/ are left out; the app fetches those live.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../js/books.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = fileURLToPath(new URL('../../data/bsb/', import.meta.url));
const dist = `${root}dist/`;
const supabaseJs = `${root}node_modules/@supabase/supabase-js/dist/umd/supabase.js`;

if (!existsSync(supabaseJs)) {
  console.error('node_modules/@supabase/supabase-js is missing: run `npm install` first.');
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(`${dist}data/bsb`, { recursive: true });
mkdirSync(`${dist}vendor`);
for (const f of ['index.html', 'styles.css', 'icon.svg']) cpSync(`${root}${f}`, `${dist}${f}`);
// js/config.local.js points a developer's browser at a local Supabase stack; it never ships.
cpSync(`${root}js`, `${dist}js`, { recursive: true, filter: (src) => !src.endsWith('config.local.js') });
cpSync(supabaseJs, `${dist}vendor/supabase.js`);

const missing = [];
for (const { id } of BOOKS) {
  if (existsSync(`${data}${id}.json`)) cpSync(`${data}${id}.json`, `${dist}data/bsb/${id}.json`);
  else missing.push(id);
}
console.log(`Bundled ${BOOKS.length - missing.length}/${BOOKS.length} books into dist/`);
if (missing.length) console.warn(`Not bundled (will load live; run npm run fetch-bible): ${missing.join(', ')}`);
