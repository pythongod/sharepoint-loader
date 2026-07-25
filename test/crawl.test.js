'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
require('../src/crawl.js');
const { crawl } = globalThis.SPL;

const file = (folder, name) => ({
  FSObjType: '0',
  FileLeafRef: name,
  FileRef: `${folder}/${name}`,
});

const folder = (parent, name) => ({
  FSObjType: '1',
  FileLeafRef: name,
  FileRef: `${parent}/${name}`,
});

// A fake API standing in for api.js: a map of folder URL to the rows it holds.
const fakeApi = (tree) => {
  const calls = [];

  return {
    calls,
    async listPage({ folderUrl }) {
      calls.push(folderUrl);

      return { rows: tree[folderUrl] || [], nextPaging: null };
    },
  };
};

const collect = () => {
  const pages = [];

  return { pages, onPage: (rows) => pages.push(rows), all: () => pages.flat() };
};

test('reads a single folder', async () => {
  const api = fakeApi({ '/docs': [file('/docs', 'a.txt'), file('/docs', 'b.txt')] });
  const sink = collect();

  const result = await crawl.run({ api, rootFolder: '/docs', onPage: sink.onPage });

  assert.strictEqual(result.found, 2);
  assert.deepStrictEqual(api.calls, ['/docs']);
});

test('does not descend when recursion is off', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'sub')],
    '/docs/sub': [file('/docs/sub', 'deep.txt')],
  });

  const result = await crawl.run({ api, rootFolder: '/docs', onPage: () => {} });

  assert.deepStrictEqual(api.calls, ['/docs']);
  assert.strictEqual(result.found, 1);
});

test('descends into subfolders when recursive', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'sub'), file('/docs', 'a.txt')],
    '/docs/sub': [file('/docs/sub', 'deep.txt')],
  });
  const sink = collect();

  const result = await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    onPage: sink.onPage,
  });

  assert.deepStrictEqual(api.calls, ['/docs', '/docs/sub']);
  assert.strictEqual(result.found, 3);
});

test('walks breadth-first', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'a'), folder('/docs', 'b')],
    '/docs/a': [folder('/docs/a', 'deep')],
    '/docs/b': [],
    '/docs/a/deep': [],
  });

  await crawl.run({ api, rootFolder: '/docs', recursive: true, onPage: () => {} });

  assert.deepStrictEqual(api.calls, ['/docs', '/docs/a', '/docs/b', '/docs/a/deep']);
});

test('tags each row with the folder it came from', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'sub')],
    '/docs/sub': [file('/docs/sub', 'deep.txt')],
  });
  const sink = collect();

  await crawl.run({ api, rootFolder: '/docs', recursive: true, onPage: sink.onPage });

  assert.deepStrictEqual(
    sink.all().map((row) => row.__folder),
    ['/docs', '/docs/sub']
  );
});

test('follows paging within a folder', async () => {
  const pages = [
    { rows: [file('/docs', 'a.txt')], nextPaging: 'Paged=TRUE&p_ID=1' },
    { rows: [file('/docs', 'b.txt')], nextPaging: 'Paged=TRUE&p_ID=2' },
    { rows: [file('/docs', 'c.txt')], nextPaging: null },
  ];
  const seen = [];
  const api = {
    async listPage({ paging }) {
      seen.push(paging);

      return pages.shift();
    },
  };

  const result = await crawl.run({ api, rootFolder: '/docs', onPage: () => {} });

  assert.strictEqual(result.found, 3);
  assert.deepStrictEqual(seen, [null, 'Paged=TRUE&p_ID=1', 'Paged=TRUE&p_ID=2']);
});

test('stops descending at the depth limit', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'one')],
    '/docs/one': [folder('/docs/one', 'two')],
    '/docs/one/two': [folder('/docs/one/two', 'three')],
  });

  const result = await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    maxDepth: 2,
    onPage: () => {},
  });

  assert.deepStrictEqual(api.calls, ['/docs', '/docs/one']);
  assert.strictEqual(result.truncated, true);
});

test('stops at the folder limit', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'a'), folder('/docs', 'b'), folder('/docs', 'c')],
    '/docs/a': [],
    '/docs/b': [],
    '/docs/c': [],
  });

  const result = await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    maxFolders: 2,
    onPage: () => {},
  });

  assert.strictEqual(api.calls.length, 2);
  assert.strictEqual(result.truncated, true);
});

test('reports a complete crawl as not truncated', async () => {
  const api = fakeApi({ '/docs': [file('/docs', 'a.txt')] });

  const result = await crawl.run({ api, rootFolder: '/docs', recursive: true, onPage: () => {} });

  assert.strictEqual(result.truncated, false);
});

test('stops when asked to', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'a'), folder('/docs', 'b')],
    '/docs/a': [],
    '/docs/b': [],
  });
  let calls = 0;

  const result = await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    onPage: () => {},
    shouldStop: () => (calls += 1) > 1,
  });

  assert.strictEqual(result.stopped, true);
  assert.ok(api.calls.length < 3);
});

test('never visits the same folder twice', async () => {
  const api = fakeApi({
    // A folder listing itself would loop forever without visit tracking.
    '/docs': [folder('/docs', 'self'), folder('/docs', 'self')],
    '/docs/self': [],
  });

  await crawl.run({ api, rootFolder: '/docs', recursive: true, onPage: () => {} });

  assert.deepStrictEqual(api.calls, ['/docs', '/docs/self']);
});

test('reports the folder currently being read', async () => {
  const api = fakeApi({
    '/docs': [folder('/docs', 'sub')],
    '/docs/sub': [],
  });
  const folders = [];

  await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    onPage: (_rows, state) => folders.push(state.folder),
  });

  assert.deepStrictEqual(folders, ['/docs', '/docs/sub']);
});

test('accumulates the running total across folders', async () => {
  const api = fakeApi({
    '/docs': [file('/docs', 'a.txt'), folder('/docs', 'sub')],
    '/docs/sub': [file('/docs/sub', 'b.txt')],
  });
  const totals = [];

  await crawl.run({
    api,
    rootFolder: '/docs',
    recursive: true,
    onPage: (_rows, state) => totals.push(state.found),
  });

  assert.deepStrictEqual(totals, [2, 3]);
});
