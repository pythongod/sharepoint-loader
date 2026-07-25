'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
const { rows } = globalThis.SPL;

test('reads rows out of a response', () => {
  const page = rows.fromResponse({ Row: [{ ID: '1' }, { ID: '2' }] });

  assert.deepStrictEqual(page.rows, [{ ID: '1' }, { ID: '2' }]);
});

test('turns NextHref into the next Paging parameter', () => {
  const page = rows.fromResponse({
    Row: [],
    NextHref: '?Paged=TRUE&p_ID=100&PageFirstRow=101',
  });

  assert.strictEqual(page.nextPaging, 'Paged=TRUE&p_ID=100&PageFirstRow=101');
});

test('reports no continuation when NextHref is absent', () => {
  assert.strictEqual(rows.fromResponse({ Row: [{ ID: '1' }] }).nextPaging, null);
});

test('treats a missing Row array as an empty page', () => {
  assert.deepStrictEqual(rows.fromResponse({}).rows, []);
});

test('builds fallback paging from the last row of a page', () => {
  assert.strictEqual(
    rows.pagingFromLastRow([{ ID: '340' }, { ID: '341' }]),
    'Paged=TRUE&p_ID=341'
  );
});

test('reports no fallback paging for an empty page', () => {
  assert.strictEqual(rows.pagingFromLastRow([]), null);
});

test('reads visible columns from the list schema', () => {
  const columns = rows.columns({
    ListSchema: {
      Field: [
        { Name: 'LinkFilename', DisplayName: 'Name' },
        { Name: 'Modified', DisplayName: 'Modified' },
      ],
    },
  });

  assert.deepStrictEqual(columns, [
    { name: 'LinkFilename', title: 'Name' },
    { name: 'Modified', title: 'Modified' },
  ]);
});

test('omits hidden schema fields', () => {
  const columns = rows.columns({
    ListSchema: {
      Field: [
        { Name: 'LinkFilename', DisplayName: 'Name' },
        { Name: 'SyncClientId', DisplayName: 'Sync', Hidden: 'TRUE' },
      ],
    },
  });

  assert.deepStrictEqual(columns, [{ name: 'LinkFilename', title: 'Name' }]);
});

test('falls back to row keys when the schema is missing', () => {
  const columns = rows.columns({ Row: [{ ID: '1', Title: 'a' }, { ID: '2', Author: 'b' }] });

  assert.deepStrictEqual(columns.map((column) => column.name), ['ID', 'Title', 'Author']);
});

test('excludes internal dot-prefixed keys from the fallback columns', () => {
  const columns = rows.columns({ Row: [{ ID: '1', '.spItemUrl': 'x', '.fileType': 'docx' }] });

  assert.deepStrictEqual(columns.map((column) => column.name), ['ID']);
});

test('identifies folders by FSObjType', () => {
  assert.strictEqual(rows.isFolder({ FSObjType: '1' }), true);
  assert.strictEqual(rows.isFolder({ FSObjType: '0' }), false);
  assert.strictEqual(rows.isFolder({}), false);
});

test('renders a plain value as text', () => {
  assert.strictEqual(rows.value({ Title: 'Report' }, 'Title'), 'Report');
});

test('renders a missing value as an empty string', () => {
  assert.strictEqual(rows.value({}, 'Title'), '');
  assert.strictEqual(rows.value({ Title: null }, 'Title'), '');
});

test('renders a lookup as its display value', () => {
  assert.strictEqual(
    rows.value({ Department: { lookupId: 4, lookupValue: 'Finance' } }, 'Department'),
    'Finance'
  );
});

test('renders a person field as its title', () => {
  assert.strictEqual(
    rows.value({ Author: [{ id: '9', title: 'Ada Lovelace', email: 'ada@contoso.com' }] }, 'Author'),
    'Ada Lovelace'
  );
});

test('joins multi-valued fields with a semicolon', () => {
  assert.strictEqual(
    rows.value({ Editor: [{ title: 'Ada' }, { title: 'Grace' }] }, 'Editor'),
    'Ada; Grace'
  );
});

test('renders a managed metadata term by its label', () => {
  assert.strictEqual(rows.value({ Topic: { Label: 'Finance' } }, 'Topic'), 'Finance');
});

test('renders a number as text', () => {
  assert.strictEqual(rows.value({ FileSizeDisplay: 20480 }, 'FileSizeDisplay'), '20480');
});
