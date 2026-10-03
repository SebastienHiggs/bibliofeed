// Downloads the whole BSB into the repo's shared data/bsb/<BOOK>.json, which is
// committed so builds don't need the network. Run it again only to refresh the
// text. It lives here because it reuses the app's book list and API parser.
//   node scripts/fetch-bible.mjs
// Exits with an error, leaving existing files untouched, if any chapter fails.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOKS } from '../js/books.js';
import { fetchApiChapter } from '../js/bible.js';

const dir = fileURLToPath(new URL('../../data/bsb/', import.meta.url));

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

if (failed.length) {
  console.error(`Failed to download: ${failed.join(', ')}. Nothing was written.`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
let bytes = 0;
for (const [id, chapters] of out) {
  const json = JSON.stringify(chapters);
  bytes += json.length;
  writeFileSync(`${dir}${id}.json`, json);
}
console.log(`Wrote ${jobs.length} chapters (${(bytes / 1e6).toFixed(1)} MB) to data/bsb/`);
