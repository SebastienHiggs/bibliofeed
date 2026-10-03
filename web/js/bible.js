// Scripture text: the Berean Standard Bible (BSB), which is public domain.
//
// The build (scripts/build.mjs) bundles the whole BSB as one JSON file per
// book under data/bsb/. If a book file is missing (e.g. running from source
// without building), chapters are fetched live from the Free Use Bible API.

export const TRANSLATION = 'BSB';
export const COPYRIGHT = 'The Holy Bible, Berean Standard Bible (BSB) is in the public domain.';

const API = 'https://bible.helloao.org/api/BSB';

function flatten(content) {
  return content
    .map((c) => (typeof c === 'string' ? c : c?.text ?? (c?.lineBreak ? ' ' : '')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”])/g, '$1')
    .trim();
}

// Free Use Bible API chapter JSON -> [{ number, text }]
export function parseApiChapter(data) {
  return data.chapter.content
    .filter((c) => c.type === 'verse')
    .map((c) => ({ number: c.number, text: flatten(c.content) }))
    .filter((v) => v.text);
}

export async function fetchApiChapter(bookId, chapter) {
  const res = await fetch(`${API}/${bookId}/${chapter}.json`);
  if (!res.ok) throw new Error(`Bible API returned ${res.status} for ${bookId} ${chapter}`);
  return parseApiChapter(await res.json());
}

// Bundled book file: [[ [verse, text], ... ], ...] indexed by chapter - 1.
const bookCache = new Map();
function loadBook(book) {
  if (!bookCache.has(book.id)) {
    bookCache.set(
      book.id,
      fetch(`data/bsb/${book.id}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return bookCache.get(book.id);
}

const chapterCache = new Map();

async function loadChapter(book, chapter) {
  const bundled = (await loadBook(book))?.[chapter - 1];
  const verses = bundled?.length
    ? bundled.map(([number, text]) => ({ number, text }))
    : await fetchApiChapter(book.id, chapter);
  return { translation: TRANSLATION, verses, copyright: COPYRIGHT };
}

// Cached per session so the feed and profiles don't refetch the same chapter.
export function getChapter(book, chapter) {
  const key = `${book.id}.${chapter}`;
  if (!chapterCache.has(key)) {
    const p = loadChapter(book, chapter);
    chapterCache.set(key, p);
    p.catch(() => chapterCache.delete(key));
  }
  return chapterCache.get(key);
}
