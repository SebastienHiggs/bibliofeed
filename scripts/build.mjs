// Builds the site into dist/, bundling the whole BSB as data/bsb/<BOOK>.json.
//   node scripts/build.mjs
// Chapters that can't be downloaded are left out; the app fetches those live.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../js/books.js';
import { fetchApiChapter } from '../js/bible.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = `${root}dist/`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(`${dist}data/bsb`, { recursive: true });
for (const f of ['index.html', 'styles.css', 'js']) cpSync(`${root}${f}`, `${dist}${f}`, { recursive: true });

async function fetchWithRetry(bookId, chapter, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fetchApiChapter(bookId, chapter);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

// Download every chapter with limited concurrency.
const jobs = BOOKS.flatMap((b) => Array.from({ length: b.chapters }, (_, i) => [b, i + 1]));
const out = new Map(BOOKS.map((b) => [b.id, Array(b.chapters).fill(null)]));
const failed = [];
let next = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (next < jobs.length) {
      const [book, chapter] = jobs[next++];
      try {
        const verses = await fetchWithRetry(book.id, chapter);
        out.get(book.id)[chapter - 1] = verses.map((v) => [v.number, v.text]);
      } catch (err) {
        failed.push(`${book.id} ${chapter}`);
        console.warn(String(err));
      }
    }
  }),
);

let bytes = 0;
for (const [id, chapters] of out) {
  const json = JSON.stringify(chapters.map((c) => c || []));
  bytes += json.length;
  writeFileSync(`${dist}data/bsb/${id}.json`, json);
}
console.log(`Bundled ${jobs.length - failed.length}/${jobs.length} chapters (${(bytes / 1e6).toFixed(1)} MB) into dist/`);
if (failed.length) console.warn(`Not bundled (will load live): ${failed.join(', ')}`);
