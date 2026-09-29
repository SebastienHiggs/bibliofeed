// The 66 books of the Protestant canon.
// id: USFM code (used by the Free Use Bible API at bible.helloao.org)
// chapters: number of chapters
// author: traditional / best-guess human author, used as the "poster"
export const BOOKS = [
  { id: 'GEN', name: 'Genesis', chapters: 50, author: 'Moses' },
  { id: 'EXO', name: 'Exodus', chapters: 40, author: 'Moses' },
  { id: 'LEV', name: 'Leviticus', chapters: 27, author: 'Moses' },
  { id: 'NUM', name: 'Numbers', chapters: 36, author: 'Moses' },
  { id: 'DEU', name: 'Deuteronomy', chapters: 34, author: 'Moses' },
  { id: 'JOS', name: 'Joshua', chapters: 24, author: 'Joshua' },
  { id: 'JDG', name: 'Judges', chapters: 21, author: 'Samuel' },
  { id: 'RUT', name: 'Ruth', chapters: 4, author: 'Samuel' },
  { id: '1SA', name: '1 Samuel', chapters: 31, author: 'Samuel' },
  { id: '2SA', name: '2 Samuel', chapters: 24, author: 'Nathan & Gad' },
  { id: '1KI', name: '1 Kings', chapters: 22, author: 'Jeremiah' },
  { id: '2KI', name: '2 Kings', chapters: 25, author: 'Jeremiah' },
  { id: '1CH', name: '1 Chronicles', chapters: 29, author: 'Ezra' },
  { id: '2CH', name: '2 Chronicles', chapters: 36, author: 'Ezra' },
  { id: 'EZR', name: 'Ezra', chapters: 10, author: 'Ezra' },
  { id: 'NEH', name: 'Nehemiah', chapters: 13, author: 'Nehemiah' },
  { id: 'EST', name: 'Esther', chapters: 10, author: 'Mordecai' },
  { id: 'JOB', name: 'Job', chapters: 42, author: 'Unknown' },
  { id: 'PSA', name: 'Psalms', chapters: 150, author: 'David' },
  { id: 'PRO', name: 'Proverbs', chapters: 31, author: 'Solomon' },
  { id: 'ECC', name: 'Ecclesiastes', chapters: 12, author: 'Solomon' },
  { id: 'SNG', name: 'Song of Solomon', chapters: 8, author: 'Solomon' },
  { id: 'ISA', name: 'Isaiah', chapters: 66, author: 'Isaiah' },
  { id: 'JER', name: 'Jeremiah', chapters: 52, author: 'Jeremiah' },
  { id: 'LAM', name: 'Lamentations', chapters: 5, author: 'Jeremiah' },
  { id: 'EZK', name: 'Ezekiel', chapters: 48, author: 'Ezekiel' },
  { id: 'DAN', name: 'Daniel', chapters: 12, author: 'Daniel' },
  { id: 'HOS', name: 'Hosea', chapters: 14, author: 'Hosea' },
  { id: 'JOL', name: 'Joel', chapters: 3, author: 'Joel' },
  { id: 'AMO', name: 'Amos', chapters: 9, author: 'Amos' },
  { id: 'OBA', name: 'Obadiah', chapters: 1, author: 'Obadiah' },
  { id: 'JON', name: 'Jonah', chapters: 4, author: 'Jonah' },
  { id: 'MIC', name: 'Micah', chapters: 7, author: 'Micah' },
  { id: 'NAM', name: 'Nahum', chapters: 3, author: 'Nahum' },
  { id: 'HAB', name: 'Habakkuk', chapters: 3, author: 'Habakkuk' },
  { id: 'ZEP', name: 'Zephaniah', chapters: 3, author: 'Zephaniah' },
  { id: 'HAG', name: 'Haggai', chapters: 2, author: 'Haggai' },
  { id: 'ZEC', name: 'Zechariah', chapters: 14, author: 'Zechariah' },
  { id: 'MAL', name: 'Malachi', chapters: 4, author: 'Malachi' },
  { id: 'MAT', name: 'Matthew', chapters: 28, author: 'Matthew' },
  { id: 'MRK', name: 'Mark', chapters: 16, author: 'Mark' },
  { id: 'LUK', name: 'Luke', chapters: 24, author: 'Luke' },
  { id: 'JHN', name: 'John', chapters: 21, author: 'John' },
  { id: 'ACT', name: 'Acts', chapters: 28, author: 'Luke' },
  { id: 'ROM', name: 'Romans', chapters: 16, author: 'Paul' },
  { id: '1CO', name: '1 Corinthians', chapters: 16, author: 'Paul' },
  { id: '2CO', name: '2 Corinthians', chapters: 13, author: 'Paul' },
  { id: 'GAL', name: 'Galatians', chapters: 6, author: 'Paul' },
  { id: 'EPH', name: 'Ephesians', chapters: 6, author: 'Paul' },
  { id: 'PHP', name: 'Philippians', chapters: 4, author: 'Paul' },
  { id: 'COL', name: 'Colossians', chapters: 4, author: 'Paul' },
  { id: '1TH', name: '1 Thessalonians', chapters: 5, author: 'Paul' },
  { id: '2TH', name: '2 Thessalonians', chapters: 3, author: 'Paul' },
  { id: '1TI', name: '1 Timothy', chapters: 6, author: 'Paul' },
  { id: '2TI', name: '2 Timothy', chapters: 4, author: 'Paul' },
  { id: 'TIT', name: 'Titus', chapters: 3, author: 'Paul' },
  { id: 'PHM', name: 'Philemon', chapters: 1, author: 'Paul' },
  { id: 'HEB', name: 'Hebrews', chapters: 13, author: 'Unknown' },
  { id: 'JAS', name: 'James', chapters: 5, author: 'James' },
  { id: '1PE', name: '1 Peter', chapters: 5, author: 'Peter' },
  { id: '2PE', name: '2 Peter', chapters: 3, author: 'Peter' },
  { id: '1JN', name: '1 John', chapters: 5, author: 'John' },
  { id: '2JN', name: '2 John', chapters: 1, author: 'John' },
  { id: '3JN', name: '3 John', chapters: 1, author: 'John' },
  { id: 'JUD', name: 'Jude', chapters: 1, author: 'Jude' },
  { id: 'REV', name: 'Revelation', chapters: 22, author: 'John' },
];

// URL slugs used by the commentary sites we link to.
export const slug = (book, sep) => book.name.toLowerCase().replace(/ /g, sep);

// Instagram-style handle for an author, e.g. "Nathan & Gad" -> "nathan_and_gad".
export const handle = (author) =>
  author.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Pick a random book weighted by chapter count, then a random chapter,
// so every chapter in the given books is equally likely.
export function randomChapter(books = BOOKS) {
  const total = books.reduce((n, b) => n + b.chapters, 0);
  let r = Math.floor(Math.random() * total);
  for (const book of books) {
    if (r < book.chapters) return { book, chapter: r + 1 };
    r -= book.chapters;
  }
  return { book: books[0], chapter: 1 };
}

// Profile bios. Authorship and lifespans are traditional attributions and rough
// estimates; many books are anonymous and scholars disagree on several.
export const AUTHORS = {
  'Moses': { lived: 'c. 1525–1405 BC', title: 'Prophet · Lawgiver', bio: 'Raised in Pharaoh’s court, met God at the burning bush, led Israel out of Egypt. Traditionally credited with the Torah.' },
  'Joshua': { lived: 'c. 1500–1390 BC', title: 'Military leader', bio: 'Moses’ assistant and successor. Led Israel across the Jordan into Canaan.' },
  'Samuel': { lived: 'c. 1100–1015 BC', title: 'Prophet · Judge', bio: 'Last of the judges. Anointed Saul and David. Traditionally credited with Judges, Ruth and 1 Samuel.' },
  'Nathan & Gad': { lived: '10th century BC', title: 'Prophets to King David', bio: 'Court prophets who, by tradition (1 Chronicles 29:29), finished the record of David’s reign.' },
  'Jeremiah': { lived: 'c. 650–570 BC', title: 'Prophet', bio: 'The weeping prophet. Warned Judah before the fall of Jerusalem. Traditionally credited with Kings and Lamentations too.' },
  'Ezra': { lived: '5th century BC', title: 'Priest · Scribe', bio: 'Led exiles home from Babylon and taught the Law. Traditionally credited with Chronicles.' },
  'Nehemiah': { lived: '5th century BC', title: 'Governor · Builder', bio: 'Cupbearer to the Persian king who rebuilt Jerusalem’s walls in 52 days.' },
  'Mordecai': { lived: '5th century BC', title: 'Official in Susa', bio: 'Esther’s cousin and guardian. Traditionally credited with recording the events of Purim.' },
  'David': { lived: 'c. 1040–970 BC', title: 'King · Poet · Musician', bio: 'Shepherd, giant-slayer and king of Israel. A man after God’s own heart. Wrote many of the Psalms.' },
  'Solomon': { lived: 'c. 990–931 BC', title: 'King · Sage', bio: 'Son of David, builder of the Temple, famous for his wisdom. Proverbs, Ecclesiastes and the Song.' },
  'Isaiah': { lived: 'c. 760–680 BC', title: 'Prophet', bio: '“Here I am! Send me.” Prophet in Jerusalem under four kings of Judah.' },
  'Ezekiel': { lived: 'c. 622–570 BC', title: 'Priest · Prophet', bio: 'Saw visions of God’s glory among the exiles by the river Chebar in Babylon.' },
  'Daniel': { lived: 'c. 620–530 BC', title: 'Statesman · Prophet', bio: 'Exile in Babylon, interpreter of dreams, survivor of the lions’ den.' },
  'Hosea': { lived: '8th century BC', title: 'Prophet', bio: 'Prophet to the northern kingdom whose own marriage pictured God’s faithful love.' },
  'Joel': { lived: 'Unknown', title: 'Prophet', bio: 'Son of Pethuel. Saw a plague of locusts as a sign of the Day of the Lord.' },
  'Amos': { lived: '8th century BC', title: 'Prophet · Shepherd', bio: 'A herdsman and fig farmer from Tekoa. “Let justice roll down like waters.”' },
  'Obadiah': { lived: '6th century BC', title: 'Prophet', bio: 'Author of the shortest book in the Old Testament, a vision concerning Edom.' },
  'Jonah': { lived: '8th century BC', title: 'Reluctant prophet', bio: 'Ran from God, spent three days in a great fish, then preached to Nineveh.' },
  'Micah': { lived: '8th century BC', title: 'Prophet', bio: 'From Moresheth. “Do justice, love kindness, and walk humbly with your God.”' },
  'Nahum': { lived: '7th century BC', title: 'Prophet', bio: 'From Elkosh. Foretold the fall of Nineveh.' },
  'Habakkuk': { lived: '7th century BC', title: 'Prophet', bio: 'Asked God hard questions. “The righteous shall live by his faith.”' },
  'Zephaniah': { lived: '7th century BC', title: 'Prophet', bio: 'Descendant of King Hezekiah who prophesied in the days of Josiah.' },
  'Haggai': { lived: '6th century BC', title: 'Prophet', bio: 'Urged the returned exiles to finish rebuilding the Temple.' },
  'Zechariah': { lived: '6th century BC', title: 'Priest · Prophet', bio: 'Contemporary of Haggai, known for night visions and messianic prophecy.' },
  'Malachi': { lived: '5th century BC', title: 'Prophet', bio: 'The last voice of the Old Testament prophets.' },
  'Matthew': { lived: '1st century AD', title: 'Apostle · Former tax collector', bio: 'Left his tax booth to follow Jesus. Wrote the Gospel for a Jewish audience.' },
  'Mark': { lived: '1st century AD', title: 'Evangelist', bio: 'John Mark, companion of Peter and Paul. Wrote the shortest, fastest-moving Gospel.' },
  'Luke': { lived: '1st century AD', title: 'Physician · Historian', bio: 'Paul’s travelling companion. Wrote an orderly account in Luke and Acts.' },
  'John': { lived: 'c. AD 6–100', title: 'Apostle · The beloved disciple', bio: 'Fisherman, son of Zebedee. Gospel, three letters and Revelation from Patmos.' },
  'Paul': { lived: 'c. AD 5–67', title: 'Apostle to the Gentiles', bio: 'Formerly Saul of Tarsus. Church planter, tentmaker and letter writer.' },
  'James': { lived: '1st century AD', title: 'Leader of the Jerusalem church', bio: 'Brother of Jesus. “Faith without works is dead.”' },
  'Peter': { lived: '1st century AD', title: 'Apostle · Fisherman', bio: 'Simon, called the Rock. Walked on water, denied Jesus, then led the early church.' },
  'Jude': { lived: '1st century AD', title: 'Servant of Jesus Christ', bio: 'Brother of James. Urged believers to contend for the faith.' },
  'Unknown': { lived: 'Unknown', title: 'Anonymous', bio: 'Books whose human author isn’t known: Job and Hebrews.' },
};
