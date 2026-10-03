// Builds the site into dist/: the app's static files plus the bundled BSB in
// data/bsb/ (downloaded by scripts/fetch-bible.mjs and committed to the repo).
//   node scripts/build.mjs
// Books missing from data/bsb/ are left out; the app fetches those live.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../js/books.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}dist/`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(`${dist}data/bsb`, { recursive: true });
for (const f of ['index.html', 'styles.css', 'icon.svg', 'js']) cpSync(`${root}${f}`, `${dist}${f}`, { recursive: true });

const missing = [];
for (const { id } of BOOKS) {
  const file = `data/bsb/${id}.json`;
  if (existsSync(`${root}${file}`)) cpSync(`${root}${file}`, `${dist}${file}`);
  else missing.push(id);
}
console.log(`Bundled ${BOOKS.length - missing.length}/${BOOKS.length} books into dist/`);
if (missing.length) console.warn(`Not bundled (will load live; run npm run fetch-bible): ${missing.join(', ')}`);
