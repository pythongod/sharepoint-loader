'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/rows.js');
require('../src/api.js');
const { api } = globalThis.SPL;

const jsonResponse = (body, init = {}) => ({
  ok: init.status === undefined || (init.status >= 200 && init.status < 300),
  status: init.status || 200,
  headers: { get: (name) => (init.headers || {})[name.toLowerCase()] || null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// Records every request and replies from a queue of handlers.
const recorder = (handlers) => {
  const calls = [];
  const queue = handlers.slice();

  const fetch = async (url, init) => {
    calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });

    const handler = queue.length > 1 ? queue.shift() : queue[0];

    return typeof handler === 'function' ? handler(url, init) : handler;
  };

  return { calls, fetch };
};

const digest = jsonResponse({ FormDigestValue: 'digest-1', FormDigestTimeoutSeconds: 1800 });

const build = (handlers, options = {}) => {
  const { calls, fetch } = recorder(handlers);
  const client = api.create({
    fetch,
    origin: 'https://contoso.sharepoint.com',
    webUrl: '/sites/team',
    listUrl: '/sites/team/Shared Documents',
    sleep: options.sleep || (async () => {}),
  });

  return { calls, client };
};

test('requests a form digest from the web that owns the list', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({});

  assert.strictEqual(
    calls[0].url,
    'https://contoso.sharepoint.com/sites/team/_api/contextinfo'
  );
  assert.strictEqual(calls[0].init.method, 'POST');
});

test('sends the digest with the list request', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({});

  assert.strictEqual(calls[1].init.headers['X-RequestDigest'], 'digest-1');
});

test('reuses a cached digest across requests', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({});
  await client.listPage({});

  assert.strictEqual(calls.filter((call) => call.url.endsWith('/_api/contextinfo')).length, 1);
});

test('encodes the list url into the RenderListDataAsStream endpoint', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({});

  assert.strictEqual(
    calls[1].url,
    'https://contoso.sharepoint.com/sites/team/_api/web/GetList(@listUrl)/RenderListDataAsStream' +
      "?@listUrl='%2Fsites%2Fteam%2FShared%20Documents'"
  );
});

test('sends the request as same-origin so the session cookie travels', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({});

  assert.strictEqual(calls[1].init.credentials, 'same-origin');
});

test('passes view, folder, paging, and page size as parameters', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({
    viewId: 'view-guid',
    folderUrl: '/sites/team/Shared Documents/Reports',
    paging: 'Paged=TRUE&p_ID=100',
    pageSize: 250,
    datesInUtc: true,
  });

  assert.deepStrictEqual(calls[1].body.parameters, {
    ViewId: 'view-guid',
    DatesInUtc: true,
    RowLimit: 250,
    FolderServerRelativeUrl: '/sites/team/Shared Documents/Reports',
    Paging: 'Paged=TRUE&p_ID=100',
  });
});

test('omits parameters that were not supplied', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({ pageSize: 500, datesInUtc: false });

  assert.deepStrictEqual(calls[1].body.parameters, { DatesInUtc: false, RowLimit: 500 });
});

test('asks for the list schema only when requested', async () => {
  const { calls, client } = build([digest, jsonResponse({ Row: [] })]);

  await client.listPage({ withSchema: true });

  assert.strictEqual(calls[1].body.parameters.RenderOptions, 4);
});

test('returns rows and the continuation token', async () => {
  const { client } = build([
    digest,
    jsonResponse({ Row: [{ ID: '1' }], NextHref: '?Paged=TRUE&p_ID=1' }),
  ]);

  const page = await client.listPage({});

  assert.deepStrictEqual(page.rows, [{ ID: '1' }]);
  assert.strictEqual(page.nextPaging, 'Paged=TRUE&p_ID=1');
});

test('reads the item count for the progress denominator', async () => {
  const { calls, client } = build([jsonResponse({ Id: 'list-guid', ItemCount: 8300, BaseType: 1 })]);

  const info = await client.listInfo();

  assert.strictEqual(info.itemCount, 8300);
  assert.ok(calls[0].url.includes('$select=Id,ItemCount,BaseType'));
  assert.strictEqual(calls[0].init.method, 'GET');
});

test('waits the server-requested delay after a 429 and retries', async () => {
  const waited = [];
  const responses = [
    digest,
    jsonResponse({}, { status: 429, headers: { 'retry-after': '12' } }),
    jsonResponse({ Row: [{ ID: '1' }] }),
  ];
  const { client } = build(responses, { sleep: async (ms) => waited.push(ms) });

  const page = await client.listPage({});

  assert.deepStrictEqual(waited, [12000]);
  assert.deepStrictEqual(page.rows, [{ ID: '1' }]);
});

test('backs off without a Retry-After header', async () => {
  const waited = [];
  const { client } = build(
    [digest, jsonResponse({}, { status: 503 }), jsonResponse({ Row: [] })],
    { sleep: async (ms) => waited.push(ms) }
  );

  await client.listPage({});

  assert.strictEqual(waited.length, 1);
  assert.ok(waited[0] > 0);
});

test('reports an expired session without retrying', async () => {
  const { calls, client } = build([digest, jsonResponse({}, { status: 401 })]);

  await assert.rejects(client.listPage({}), (error) => error.kind === 'session-expired');
  assert.strictEqual(calls.length, 2);
});

test('reports a permission failure', async () => {
  const { client } = build([digest, jsonResponse({}, { status: 403 })]);

  await assert.rejects(client.listPage({}), (error) => error.kind === 'forbidden');
});

test('reports a missing list', async () => {
  const { client } = build([digest, jsonResponse({}, { status: 404 })]);

  await assert.rejects(client.listPage({}), (error) => error.kind === 'not-found');
});

test('surfaces the SharePoint message for a list view threshold failure', async () => {
  const message =
    'The attempted operation is prohibited because it exceeds the list view threshold.';
  const { client } = build([
    digest,
    jsonResponse({ 'odata.error': { message: { value: message } } }, { status: 500 }),
  ]);

  await assert.rejects(client.listPage({}), (error) => {
    assert.strictEqual(error.kind, 'threshold');
    assert.match(error.message, /list view threshold/);

    return true;
  });
});

test('gives up after repeated network failures', async () => {
  let attempts = 0;
  const { client } = build(
    [
      digest,
      () => {
        attempts += 1;

        throw new TypeError('Failed to fetch');
      },
    ],
    { sleep: async () => {} }
  );

  await assert.rejects(client.listPage({}), (error) => error.kind === 'network');
  assert.strictEqual(attempts, 3);
});
