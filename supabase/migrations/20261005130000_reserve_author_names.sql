-- Bible authors' handles are reserved too (the owner reversed the earlier
-- decision): nobody may be @paul or @john, so a comment can't look like it
-- came from an author. This list must match handle() over ALL_AUTHORS in
-- web/js/books.js; the test runner checks that it does.

alter table profiles add constraint profiles_username_not_author check (username not in (
  'amos', 'asaph', 'daniel', 'david', 'ethan', 'ezekiel', 'ezra', 'habakkuk', 'haggai', 'hosea', 'isaiah',
  'james', 'jeremiah', 'joel', 'john', 'jonah', 'joshua', 'jude', 'luke', 'malachi', 'mark', 'matthew',
  'micah', 'mordecai', 'moses', 'nahum', 'nathan_and_gad', 'nehemiah', 'obadiah', 'paul', 'peter', 'samuel',
  'solomon', 'sons_of_korah', 'unknown', 'zechariah', 'zephaniah'
));
