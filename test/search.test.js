'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
require('../src/url.js');
require('../src/crawl.js');
require('../src/search.js');
const { search } = globalThis.SPL;

const PAGE =
  'https://contoso.sharepoint.com/sites/team/Customers/Forms/AllItems.aspx' +
  '?viewid=1a2b3c4d-0000-0000-0000-000000000001';

const ROOT = '/sites/team/Customers';

const folder = (name) => ({
  FSObjType: '1',
  FileLeafRef: name,
  FileRef: `${ROOT}/${name}`,
});

const file = (name) => ({
  FSObjType: '0',
  FileLeafRef: name,
  FileRef: `${ROOT}/${name}`,
});

const named = (...names) => names.map((name) => ({ name, isFolder: true, url: null }));

// Pages of rows, handed out in order, so paging is exercised end to end.
const fakeApi = (pages, info) => {
  const calls = [];

  return {
    calls,
    async listInfo() {
      if (!info) throw new Error('no metadata');

      return info;
    },
    async listPage(request) {
      calls.push(request);

      const index = calls.length - 1;

      return {
        rows: pages[index] || [],
        nextPaging: index < pages.length - 1 ? `Paged=TRUE&p_ID=${index}` : null,
      };
    },
  };
};

const context = { origin: 'https://contoso.sharepoint.com', listUrl: ROOT, folderUrl: ROOT, viewId: 'v1' };

const index = (pages, options = {}) =>
  search.index({
    api: options.api || fakeApi(pages, { isLibrary: true }),
    context,
    pageHref: PAGE,
    settings: { pageSize: 500 },
    isLibrary: true,
    ...options,
  });

test('matches every term in any order, ignoring case', () => {
  const entries = named('NTT_Global_Data_Centers', 'Netto', 'Nexi');

  assert.deepStrictEqual(
    search.matches(entries, 'data ntt').hits.map((hit) => hit.name),
    ['NTT_Global_Data_Centers']
  );
  assert.deepStrictEqual(
    search.matches(entries, 'ntt').hits.map((hit) => hit.name),
    ['NTT_Global_Data_Centers']
  );
});

test('finds the folder that find-in-page could not', () => {
  // The case from the field: 343 folders in the list, the row nowhere in the
  // document because SharePoint had recycled it.
  const entries = named(...Array.from({ length: 342 }, (_, n) => `Customer ${n}`), 'NTT_Global_Data_Centers');

  assert.deepStrictEqual(search.matches(entries, 'NTT').hits.map((hit) => hit.name), [
    'NTT_Global_Data_Centers',
  ]);
});

test('ranks names that start with the query first', () => {
  const entries = named('Deutsche Netto', 'Netto', 'Nettovision');

  assert.deepStrictEqual(search.matches(entries, 'netto').hits.map((hit) => hit.name), [
    'Netto',
    'Nettovision',
    'Deutsche Netto',
  ]);
});

test('ignores accents, so a plain query finds an umlaut', () => {
  const entries = named('NürnbergMesse', 'W. Kohlhammer GmbH');

  assert.deepStrictEqual(search.matches(entries, 'nurnberg').hits.map((hit) => hit.name), [
    'NürnbergMesse',
  ]);
});

test('counts every match but returns at most the limit', () => {
  const entries = named(...Array.from({ length: 120 }, (_, n) => `Customer ${n}`));
  const { hits, total } = search.matches(entries, 'customer', { limit: 50 });

  assert.strictEqual(hits.length, 50);
  assert.strictEqual(total, 120);
});

test('an empty query matches nothing rather than everything', () => {
  const entries = named('Netto', 'Nexi');

  for (const query of ['', '   ', null, undefined]) {
    assert.deepStrictEqual(search.matches(entries, query), { hits: [], total: 0 });
  }
});

test('indexes every page of the folder', async () => {
  const result = await index([[folder('Netto'), file('notes.docx')], [folder('Nexi')]]);

  assert.deepStrictEqual(
    result.entries.map((entry) => entry.name),
    ['Netto', 'notes.docx', 'Nexi']
  );
  assert.strictEqual(result.truncated, false);
  assert.strictEqual(result.stopped, false);
});

test('reads the folder and view the panel is looking at', async () => {
  const api = fakeApi([[folder('Netto')]], { isLibrary: true });

  await index(null, { api });

  assert.deepStrictEqual(api.calls[0], {
    folderUrl: ROOT,
    paging: null,
    viewId: 'v1',
    pageSize: 500,
  });
});

test('a folder links into the view, keeping the view id', async () => {
  const { entries } = await index([[folder('NTT_Global_Data_Centers')]]);

  assert.deepStrictEqual(entries[0], {
    name: 'NTT_Global_Data_Centers',
    isFolder: true,
    url:
      'https://contoso.sharepoint.com/sites/team/Customers/Forms/AllItems.aspx' +
      '?id=%2Fsites%2Fteam%2FCustomers%2FNTT_Global_Data_Centers' +
      '&viewid=1a2b3c4d-0000-0000-0000-000000000001',
  });
});

test('a document links to its own path, with each segment encoded', async () => {
  const { entries } = await index([[file('Q3 report.docx')]]);

  assert.deepStrictEqual(entries[0], {
    name: 'Q3 report.docx',
    isFolder: false,
    url: 'https://contoso.sharepoint.com/sites/team/Customers/Q3%20report.docx',
  });
});

test('an item of a generic list links to its display form', async () => {
  const { entries } = await index([[{ FSObjType: '0', ID: '42', Title: 'Ticket 42' }]], {
    isLibrary: false,
  });

  assert.deepStrictEqual(entries[0], {
    name: 'Ticket 42',
    isFolder: false,
    url: 'https://contoso.sharepoint.com/sites/team/Customers/DispForm.aspx?ID=42',
  });
});

test('asks the list whether it is a library when the panel has not', async () => {
  const api = fakeApi([[{ FSObjType: '0', ID: '7', Title: 'Ticket 7' }]], { isLibrary: false });
  const { entries } = await search.index({
    api,
    context,
    pageHref: PAGE,
    settings: { pageSize: 500 },
    onProgress: () => {},
  });

  assert.strictEqual(entries[0].url.endsWith('/DispForm.aspx?ID=7'), true);
});

test('unreadable list metadata still yields an index', async () => {
  const api = fakeApi([[file('notes.docx')]], null);
  const { entries } = await search.index({
    api,
    context,
    pageHref: PAGE,
    settings: { pageSize: 500 },
  });

  assert.strictEqual(entries.length, 1);
});

test('takes the name from whichever field the view carries', async () => {
  const { entries } = await index([
    [
      { FSObjType: '0', LinkFilename: 'linked.docx', FileRef: `${ROOT}/linked.docx` },
      { FSObjType: '0', LinkTitle: 'A list item', FileRef: `${ROOT}/1_.000` },
      { FSObjType: '1', FileRef: `${ROOT}/Unnamed folder` },
    ],
  ]);

  assert.deepStrictEqual(
    entries.map((entry) => entry.name),
    ['linked.docx', 'A list item', 'Unnamed folder']
  );
});

test('stops at the entry ceiling and says the index is truncated', async () => {
  const page = Array.from({ length: search.MAX_ENTRIES }, (_, n) => folder(`Customer ${n}`));
  const result = await index([page, [folder('Never read')]]);

  assert.strictEqual(result.entries.length, search.MAX_ENTRIES);
  assert.strictEqual(result.truncated, true);
  assert.strictEqual(result.stopped, false);
});

test('a caller that stops the read gets what was read, marked stopped', async () => {
  let seen = 0;
  const result = await index([[folder('Netto')], [folder('Nexi')]], {
    onProgress: () => {
      seen += 1;
    },
    shouldStop: () => seen > 0,
  });

  assert.deepStrictEqual(
    result.entries.map((entry) => entry.name),
    ['Netto']
  );
  assert.strictEqual(result.stopped, true);
  assert.strictEqual(result.truncated, false);
});

test('reports progress as the folder is read', async () => {
  const seen = [];

  await index([[folder('Netto')], [folder('Nexi')]], {
    onProgress: (state) => seen.push(state.found),
  });

  assert.deepStrictEqual(seen, [1, 2]);
});
