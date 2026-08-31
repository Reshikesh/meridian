const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Repo root is three levels above this file (tests/e2e/lib).
const ROOT = path.resolve(__dirname, '..', '..', '..');

// The checkout path contains a space ("Time Tracker"), so the URL MUST be
// percent-encoded. pathToFileURL does that and produces the file:///C:/... form
// Windows needs — never hand-build this string.
const APP_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;

// Absolute file:// URL for any other file in the repo, same encoding rules.
const fileUrl = (...parts) => pathToFileURL(path.join(ROOT, ...parts)).href;

module.exports = { ROOT, APP_URL, fileUrl };
