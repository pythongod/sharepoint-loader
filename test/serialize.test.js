'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
require('../src/serialize.js');
const { serialize } = globalThis.SPL;

const columns = [
  { name: 'LinkFilename', title: 'Name' },
  { name: 'Modified', title: 'Modified' },
];

test('writes a header row from the column titles', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(csv.header(), 'Name,Modified\r\n');
});

test('writes a data row in column order', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(
    csv.chunk([{ LinkFilename: 'Report.docx', Modified: '3 May' }]),
    'Report.docx,3 May\r\n'
  );
});

test('quotes values containing the delimiter', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(
    csv.chunk([{ LinkFilename: 'Budget, final.xlsx', Modified: '' }]),
    '"Budget, final.xlsx",\r\n'
  );
});

test('doubles embedded quotes', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(csv.chunk([{ LinkFilename: 'The "final" copy' }]), '"The ""final"" copy",\r\n');
});

test('quotes values containing newlines', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(csv.chunk([{ LinkFilename: 'line one\nline two' }]), '"line one\nline two",\r\n');
});

test('uses the configured delimiter', () => {
  const csv = serialize.csv({ columns, delimiter: ';' });

  assert.strictEqual(csv.chunk([{ LinkFilename: 'a', Modified: 'b' }]), 'a;b\r\n');
});

test('quotes on the configured delimiter rather than the comma', () => {
  const csv = serialize.csv({ columns, delimiter: ';' });

  assert.strictEqual(csv.chunk([{ LinkFilename: 'a;b', Modified: 'c,d' }]), '"a;b";c,d\r\n');
});

test('prefixes values that Excel would evaluate as a formula', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(csv.chunk([{ LinkFilename: '=1+1' }]), "'=1+1,\r\n");
  assert.strictEqual(csv.chunk([{ LinkFilename: '+SUM(A1)' }]), "'+SUM(A1),\r\n");
  assert.strictEqual(csv.chunk([{ LinkFilename: '-2+3' }]), "'-2+3,\r\n");
  assert.strictEqual(csv.chunk([{ LinkFilename: '@import' }]), "'@import,\r\n");
});

test('leaves ordinary leading characters alone', () => {
  const csv = serialize.csv({ columns });

  assert.strictEqual(csv.chunk([{ LinkFilename: 'Report.docx' }]), 'Report.docx,\r\n');
});

test('emits a byte order mark when asked', () => {
  assert.strictEqual(serialize.csv({ columns, bom: true }).header().charCodeAt(0), 0xfeff);
});

test('omits the byte order mark by default', () => {
  assert.notStrictEqual(serialize.csv({ columns }).header().charCodeAt(0), 0xfeff);
});

test('adds a folder path column when crawling', () => {
  const csv = serialize.csv({ columns, pathColumn: 'Folder' });

  assert.strictEqual(csv.header(), 'Folder,Name,Modified\r\n');
  assert.strictEqual(
    csv.chunk([{ LinkFilename: 'a.docx', __folder: '/sites/team/Docs/2019' }]),
    '/sites/team/Docs/2019,a.docx,\r\n'
  );
});

test('renders complex field values through the row formatter', () => {
  const csv = serialize.csv({ columns: [{ name: 'Author', title: 'Author' }] });

  assert.strictEqual(csv.chunk([{ Author: [{ title: 'Ada' }, { title: 'Grace' }] }]), 'Ada; Grace\r\n');
});

test('quotes a joined multi-value field when the delimiter is a semicolon', () => {
  const csv = serialize.csv({ columns: [{ name: 'Author', title: 'Author' }], delimiter: ';' });

  assert.strictEqual(csv.chunk([{ Author: [{ title: 'Ada' }, { title: 'Grace' }] }]), '"Ada; Grace"\r\n');
});

test('frames a json document across chunks', () => {
  const json = serialize.json({ columns });

  assert.strictEqual(json.header(), '[');
  assert.strictEqual(json.chunk([{ LinkFilename: 'a.docx', Modified: '3 May' }]), '\n{"Name":"a.docx","Modified":"3 May"}');
  assert.strictEqual(json.chunk([{ LinkFilename: 'b.docx', Modified: '4 May' }]), ',\n{"Name":"b.docx","Modified":"4 May"}');
  assert.strictEqual(json.footer(), '\n]\n');
});

test('produces valid json for an empty result', () => {
  const json = serialize.json({ columns });

  assert.deepStrictEqual(JSON.parse(json.header() + json.footer()), []);
});
