// Commentary "comments" for a post.
//
// Summaries come from public-domain commentaries hosted by the Free Use Bible
// API (https://bible.helloao.org). Each comment also links out to the full
// text on free commentary sites.

import { slug } from './books.js';

const API = 'https://bible.helloao.org/api/c';

// id: commentary id on bible.helloao.org
// biblehub: path segment for the chapter commentary on biblehub.com
const COMMENTARIES = [
  { id: 'matthew-henry', handle: 'matthew_henry', name: 'Matthew Henry’s Commentary', biblehub: 'mhc' },
  { id: 'john-gill', handle: 'john_gill', name: 'John Gill’s Exposition', biblehub: 'gill' },
  { id: 'adam-clarke', handle: 'adam_clarke', name: 'Adam Clarke’s Commentary', biblehub: 'clarke' },
  { id: 'jamieson-fausset-brown', handle: 'jamieson_fausset_brown', name: 'Jamieson-Fausset-Brown', biblehub: 'jfb' },
  { id: 'keil-delitzsch', handle: 'keil_delitzsch', name: 'Keil & Delitzsch (Old Testament)', biblehub: 'kad' },
  { id: 'tyndale', handle: 'tyndale_study_notes', name: 'Tyndale Open Study Notes', biblehub: null },
];

const chapterCache = new Map();

async function fetchCommentaryChapter(commentaryId, book, chapter) {
  const key = `${commentaryId}/${book.id}/${chapter}`;
  if (!chapterCache.has(key)) {
    chapterCache.set(
      key,
      fetch(`${API}/${key}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );
  }
  return chapterCache.get(key);
}

const flatten = (content) =>
  (content || [])
    .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

// Commentaries often cover a range of verses under the first verse number, so
// use the closest entry at or before the requested verse.
function textForVerse(data, verse) {
  const entries = (data?.chapter?.content || []).filter((c) => c.type === 'verse' && c.number <= verse);
  const best = entries.sort((a, b) => b.number - a.number)[0];
  if (best) {
    const text = flatten(best.content);
    if (text) return { text, from: best.number };
  }
  const intro = flatten(data?.chapter?.introduction ? [data.chapter.introduction] : []);
  return intro ? { text: intro, from: null } : null;
}

// First couple of sentences, capped in length.
export function summarize(text, maxChars = 260) {
  const sentences = text.match(/[^.!?]+[.!?]+["'’”)]*\s*/g) || [text];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).length > maxChars) break;
    out += s;
    if (out.length > maxChars * 0.6) break;
  }
  out = out.trim();
  return out.length > maxChars ? out.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : out;
}

export function studyLinks(book, chapter, verse) {
  const under = slug(book, '_');
  const dash = slug(book, '-');
  return [
    { label: 'All commentaries on this verse — Bible Hub', url: `https://biblehub.com/commentaries/${under}/${chapter}-${verse}.htm` },
    { label: 'StudyLight commentaries', url: `https://www.studylight.org/commentary/${dash}/${chapter}-${verse}.html` },
    { label: 'Enduring Word (David Guzik)', url: `https://enduringword.com/bible-commentary/${dash}-${chapter}/` },
  ];
}

export async function getComments(book, chapter, verse) {
  const under = slug(book, '_');
  const results = await Promise.all(
    COMMENTARIES.map(async (c) => {
      const data = await fetchCommentaryChapter(c.id, book, chapter);
      const found = data && textForVerse(data, verse);
      if (!found) return null;
      return {
        handle: c.handle,
        source: c.name,
        summary: summarize(found.text),
        full: found.text,
        from: found.from,
        url: c.biblehub
          ? `https://biblehub.com/commentaries/${c.biblehub}/${under}/${chapter}.htm`
          : `https://biblehub.com/commentaries/${under}/${chapter}-${verse}.htm`,
      };
    }),
  );
  return results.filter(Boolean);
}
