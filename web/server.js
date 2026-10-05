// Zero-dependency static server for local development.
//   node server.js          serves the source (chapters load live from the API)
//   node server.js dist     serves the build (bundled Bible)
import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(web, process.argv[2] || '.');
const port = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

// When serving the source, three paths come from elsewhere (the build copies them into dist/):
// the bundled supabase-js from node_modules, the Bible text from the repo's shared data/bsb/,
// and js/config.local.js (uncommitted, pointing at a local Supabase stack) in place of
// js/config.js when it exists.
const SOURCE_ONLY = root === resolve(web);
const VENDOR = { '/vendor/supabase.js': 'node_modules/@supabase/supabase-js/dist/umd/supabase.js' };
const DATA = resolve(web, '../data');

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  let rel = pathname === '/' ? 'index.html' : pathname;
  if (SOURCE_ONLY && VENDOR[rel]) rel = VENDOR[rel];
  if (SOURCE_ONLY && rel === '/js/config.js' && existsSync(join(root, 'js/config.local.js'))) rel = 'js/config.local.js';
  let base = root;
  if (SOURCE_ONLY && rel.startsWith('/data/bsb/')) { base = DATA; rel = rel.slice('/data'.length); }
  let path = normalize(join(base, rel));
  if (!path.startsWith(base)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Bibliofeed on http://localhost:${port} (serving ${root})`));
