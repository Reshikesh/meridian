// Workbook fixtures, built at test time from the app's own encoder and the
// vendored SheetJS.
//
// Deliberately not committed as .xlsx files: a binary fixture goes stale the
// moment a column changes, and the failure it then produces looks like a bug in
// the importer rather than a stale fixture. Built here, they cannot drift.

const XLSX = require('../../../vendor/xlsx.full.min.js');
const workbook = require('../../../src/core/workbook.js');
const { demoState, REFERENCE_DAY } = require('./seed-state');

// A file the app itself would have written.
function validBook(state) {
  return Buffer.from(workbook.encode(XLSX, state || demoState(), { now: REFERENCE_DAY }));
}

// The same file with exactly three rows broken, one per failure class the
// import report has to name: a duration that is not a number, a date that is
// not ISO, and a foreign key that points at nothing.
//
// Edited as cells, the way the friend would edit it in Excel — not as objects
// — so the test exercises the real read path.
function brokenBook(state) {
  const wb = XLSX.read(validBook(state), { type: 'buffer', cellDates: false, raw: true });
  const ws = wb.Sheets.Entries;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const head = rows[0];
  const col = (name) => head.indexOf(name);

  // Rows 2, 3 and 4 of the sheet as Excel numbers them.
  rows[1][col('duration_min')] = 'ninety';
  rows[2][col('date')] = '7/6/2026';
  rows[3][col('category_id')] = 'cat_does_not_exist';

  wb.Sheets.Entries = XLSX.utils.aoa_to_sheet(rows);
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: false }));
}

// Not a workbook at all: the "import failed" state, distinct from row rejects.
function notAWorkbook() {
  return Buffer.from('this is not a spreadsheet', 'utf8');
}

// A workbook written by a version of Meridian that does not exist yet.
function futureSchemaBook(state) {
  const wb = XLSX.read(validBook(state), { type: 'buffer', cellDates: false, raw: true });
  wb.Sheets.Meta = XLSX.utils.aoa_to_sheet([
    ['key', 'value'],
    ['schema_version', workbook.SCHEMA_VERSION + 1],
    ['app_version', '99.0.0'],
  ]);
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: false }));
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const asUpload = (buffer, name) => ({ name, mimeType: XLSX_MIME, buffer });

module.exports = { XLSX, validBook, brokenBook, notAWorkbook, futureSchemaBook, asUpload, XLSX_MIME };
