'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
require('../src/serialize.js');
require('../src/crawl.js');
require('../src/download.js');
require('../src/export.js');
const { exporter, settings } = require('./load-settings.js');

const schema = {
  ListSchema: {
    Field: [
      { Name: 'LinkFilename', DisplayName: 'Name' },
      { Name: 'Modified', DisplayName: 'Modified' },
    ],
  },
};

const file = (folder, name) => ({
  FSObjType: '0',
  LinkFilename: name,
  Modified: '3 May',
  FileRef: `${folder}/${name}`,
});

const folderRow = (parent, name) => ({
  FSObjType: '1',
  LinkFilename: name,
  Modified: '3 May',
  FileRef: `${parent}/${name}`,
});

const context = {
  origin: 'https://contoso.sharepoint.com',
  webUrl: '/sites/team',
  listUrl: '/sites/team/Docs',
  folderUrl: '/sites/team/Docs',
  viewId: 'view-guid',
};

// Serves folders from a map and reports the schema on the first call.
const fakeApi = (tree, itemCount = 2) => {
  const requests = [];

  return {
    requests,
    async listInfo() {
      return { id: 'list-guid', itemCount, isLibrary: true };
    },
    async listPage(request) {
      requests.push(request);

      const rows = tree[request.folderUrl] || [];

      return {
        rows,
        nextPaging: null,
        columns: request.withSchema ? globalThis.SPL.rows.columns(schema) : null,
      };
    },
  };
};

const saver = () => {
  const saved = [];

  return { saved, save: (fileName, chunks, format) => saved.push({ fileName, chunks, format }) };
};

const run = (options) =>
  exporter.run({
    context,
    settings: settings.defaults,
    format: 'csv',
    onProgress: () => {},
    shouldStop: () => false,
    ...options,
  });

test('saves a csv built from the view schema', async () => {
  const api = fakeApi({ '/sites/team/Docs': [file('/sites/team/Docs', 'a.docx')] });
  const sink = saver();

  await run({ api, save: sink.save });

  assert.strictEqual(sink.saved.length, 1);
  assert.strictEqual(sink.saved[0].chunks.join(''), '\ufeffName,Modified\r\na.docx,3 May\r\n');
});

test('names the file after the list', async () => {
  const api = fakeApi({ '/sites/team/Docs': [] });
  const sink = saver();

  await run({ api, save: sink.save });

  assert.match(sink.saved[0].fileName, /^Docs-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('requests the schema only on the first page', async () => {
  const api = fakeApi({
    '/sites/team/Docs': [folderRow('/sites/team/Docs', 'sub')],
    '/sites/team/Docs/sub': [file('/sites/team/Docs/sub', 'b.docx')],
  });

  await run({ api, recursive: true, save: () => {} });

  assert.deepStrictEqual(api.requests.map((request) => Boolean(request.withSchema)), [true, false]);
});

test('passes view, page size, and date handling to the api', async () => {
  const api = fakeApi({ '/sites/team/Docs': [] });

  await run({ api, save: () => {} });

  assert.strictEqual(api.requests[0].viewId, 'view-guid');
  assert.strictEqual(api.requests[0].pageSize, 500);
  assert.strictEqual(api.requests[0].datesInUtc, true);
});

test('reports progress against the item count for a whole-list export', async () => {
  const api = fakeApi({ '/sites/team/Docs': [file('/sites/team/Docs', 'a.docx')] }, 8300);
  const states = [];

  await run({ api, save: () => {}, onProgress: (state) => states.push(state) });

  assert.strictEqual(states.at(-1).total, 8300);
  assert.strictEqual(states.at(-1).folder, undefined);
});

test('reports no total when crawling subfolders', async () => {
  const api = fakeApi({ '/sites/team/Docs': [file('/sites/team/Docs', 'a.docx')] }, 8300);
  const states = [];

  await run({ api, recursive: true, save: () => {}, onProgress: (state) => states.push(state) });

  assert.strictEqual(states.at(-1).total, undefined);
  assert.strictEqual(states.at(-1).folder, '/sites/team/Docs');
});

test('reports no total when the view is scoped to a subfolder', async () => {
  const api = fakeApi({ '/sites/team/Docs/Reports': [] }, 8300);
  const states = [];

  await run({
    api,
    context: { ...context, folderUrl: '/sites/team/Docs/Reports' },
    save: () => {},
    onProgress: (state) => states.push(state),
  });

  assert.strictEqual(states.at(-1).total, undefined);
});

test('adds a folder path column when crawling', async () => {
  const api = fakeApi({
    '/sites/team/Docs': [folderRow('/sites/team/Docs', 'sub')],
    '/sites/team/Docs/sub': [file('/sites/team/Docs/sub', 'b.docx')],
  });
  const sink = saver();

  await run({ api, recursive: true, save: sink.save });

  const text = sink.saved[0].chunks.join('');

  assert.match(text, /^\ufeffFolder,Name,Modified\r\n/);
  assert.match(text, /\/sites\/team\/Docs\/sub,b\.docx,3 May/);
});

test('writes json when asked', async () => {
  const api = fakeApi({ '/sites/team/Docs': [file('/sites/team/Docs', 'a.docx')] });
  const sink = saver();

  await run({ api, format: 'json', save: sink.save });

  assert.deepStrictEqual(JSON.parse(sink.saved[0].chunks.join('')), [
    { Name: 'a.docx', Modified: '3 May' },
  ]);
});

test('still writes a valid file when the list is empty', async () => {
  const api = fakeApi({ '/sites/team/Docs': [] });
  const sink = saver();

  await run({ api, format: 'json', save: sink.save });

  assert.deepStrictEqual(JSON.parse(sink.saved[0].chunks.join('')), []);
});

test('carries partial results on the error when a page fails', async () => {
  let call = 0;
  const api = {
    async listInfo() {
      return { itemCount: 10, isLibrary: true };
    },
    async listPage(request) {
      call += 1;

      if (call === 1) {
        return {
          rows: [file('/sites/team/Docs', 'a.docx'), folderRow('/sites/team/Docs', 'sub')],
          nextPaging: null,
          columns: globalThis.SPL.rows.columns(schema),
        };
      }

      const error = new Error('Throttled for too long.');

      error.kind = 'failed';

      throw error;
    },
  };

  await assert.rejects(
    run({ api, recursive: true, save: () => {} }),
    (error) => {
      assert.strictEqual(error.partial.found, 2);
      assert.match(error.partial.chunks.join(''), /a\.docx/);

      return true;
    }
  );
});

test('reports a truncated crawl', async () => {
  const api = fakeApi({
    '/sites/team/Docs': [folderRow('/sites/team/Docs', 'a'), folderRow('/sites/team/Docs', 'b')],
    '/sites/team/Docs/a': [],
    '/sites/team/Docs/b': [],
  });

  const result = await run({
    api,
    recursive: true,
    settings: { ...settings.defaults, maxCrawlFolders: 1 },
    save: () => {},
  });

  assert.strictEqual(result.truncated, true);
});

test('does not save when the run was stopped', async () => {
  const api = fakeApi({ '/sites/team/Docs': [] });
  const sink = saver();

  const result = await run({ api, shouldStop: () => true, save: sink.save });

  assert.strictEqual(result.stopped, true);
  assert.strictEqual(sink.saved.length, 0);
});
