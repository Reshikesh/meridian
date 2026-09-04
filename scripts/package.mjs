/* Cuts dist/meridian-<version>.zip — the folder the friend unzips and
   double-clicks. `npm run package`.

   The version comes from src/core/version.js, the same constant the app shows
   and stamps into every export (decision 28), so the artefact cannot be named
   for a build it does not contain.

   What goes in is an allowlist, not everything-minus-a-few-things. A denylist
   at a packaging gate fails open: the day someone adds a folder, it ships. This
   fails closed — anything new is absent until it is named here.

   Zipping is PowerShell's Compress-Archive, which is on every Windows machine
   this project will ever be built on, so the app keeps its zero dependencies. */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/* The core modules are CommonJS under a UMD guard (see the footer of any file
   in src/core/), so this ESM script reaches the constant through require. */
const { VERSION } = createRequire(import.meta.url)('../src/core/version.js');

const STAGE = join(DIST, `meridian-${VERSION}`);
const ZIP = join(DIST, `meridian-${VERSION}.zip`);

/* Everything the app needs to run from file://, and nothing else. */
const INCLUDE = [
  'index.html',
  'styles',
  'src',
  'vendor',
  'seed',
];

/* Copied in from dist/, renamed so the friend meets it first. */
const README = 'README-for-tester.md';

/* Nothing here may appear anywhere inside the staged folder. `data` is the
   owner's own logged life; `.git` and `node_modules` are bulk; the rest is
   build and editor litter. */
const FORBIDDEN = new Set([
  '.git', 'node_modules', 'tests', 'docs', 'design', 'dist',
  '.DS_Store', 'Thumbs.db', 'package.json', 'package-lock.json',
]);

function fail(message) {
  console.error('package: ' + message);
  process.exit(1);
}

/* Every file that will ship, so the checks below look at the artefact rather
   than at the intention. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!existsSync(join(DIST, README))) fail(`dist/${README} is missing`);

rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(STAGE, { recursive: true });

for (const item of INCLUDE) {
  const from = join(ROOT, item);
  if (!existsSync(from)) fail(`${item} is missing from the repository`);
  cpSync(from, join(STAGE, item), { recursive: true });
}
cpSync(join(DIST, README), join(STAGE, README));

/* The tester is told to export into a `data` folder next to index.html, so the
   folder ships. It needs a file in it: Compress-Archive drops empty
   directories, and the friend would unzip and find nowhere to put anything. */
mkdirSync(join(STAGE, 'data'), { recursive: true });
writeFileSync(join(STAGE, 'data', 'PUT-YOUR-EXPORTS-HERE.txt'), [
  'Meridian saves its workbooks here when you click DATA then Export.',
  '',
  'One file a day, named meridian-data-2026-09-03.xlsx and so on. They are',
  'ordinary Excel files: open them, read them, edit them if you like.',
  '',
  'This is your only backup. The browser can lose what it is holding; a file',
  'in this folder cannot.',
  '',
].join('\r\n'));

const shipped = walk(STAGE).map((f) => relative(STAGE, f).split('\\').join('/'));

/* ---------- the checks that make this a gate rather than a copy ---------- */

for (const file of shipped) {
  for (const part of file.split('/')) {
    if (FORBIDDEN.has(part)) fail(`${file} contains a forbidden path segment "${part}"`);
  }
}

if (!shipped.includes('index.html')) fail('index.html did not make it into the zip');
if (!shipped.includes(README)) fail('the tester README did not make it into the zip');
if (shipped.some((f) => f.endsWith('.spec.js'))) fail('a test file reached the zip');
/* The staged data/ is a new, empty folder for the friend — never the owner's
   own, which INCLUDE does not name. Both facts are checked on the artefact:
   the placeholder is the ONLY thing under data/, and no workbook ships at all. */
if (!shipped.includes('data/PUT-YOUR-EXPORTS-HERE.txt')) fail('the data folder did not ship');
const inData = shipped.filter((f) => f.startsWith('data/'));
if (inData.length !== 1) fail('data/ holds more than the placeholder: ' + inData.join(', '));
if (shipped.some((f) => /\.(xlsx|xlsm|csv)$/i.test(f))) fail('a workbook reached the zip');

/* No network at runtime is the constraint the whole build rests on, so it is
   checked on the shipped bytes, not on the source it was copied from. */
const REMOTE = /(https?:)?\/\/(?!\s)[a-z0-9-]+\.[a-z]/i;
for (const file of shipped.filter((f) => /\.(html|css|js)$/.test(f))) {
  if (file.startsWith('vendor/')) continue;   // minified libraries carry URLs in comments
  const text = execFileSync('node', ['-e',
    `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(STAGE, file))}, 'utf8'))`,
  ]).toString();
  for (const line of text.split('\n')) {
    if (!REMOTE.test(line)) continue;
    // A URL inside a comment is documentation, not a request.
    const bare = line.trim();
    if (bare.startsWith('*') || bare.startsWith('//') || bare.startsWith('/*')) continue;
    if (/(src|href)\s*=\s*["'](https?:)?\/\//i.test(line) || /@import|url\(\s*["']?https?:/i.test(line)) {
      fail(`${file} references a remote URL: ${bare.slice(0, 90)}`);
    }
  }
}

execFileSync('powershell', [
  '-NoProfile', '-NonInteractive', '-Command',
  `Compress-Archive -Path '${STAGE}\\*' -DestinationPath '${ZIP}' -Force`,
], { stdio: 'inherit' });

if (!existsSync(ZIP)) fail('the zip was not written');

const bytes = statSync(ZIP).size;
console.log(`dist/meridian-${VERSION}.zip  ${(bytes / 1024 / 1024).toFixed(2)} MB  ${shipped.length} files`);
console.log('contents: ' + INCLUDE.join(', ') + ', ' + README + ', data/ (empty)');
