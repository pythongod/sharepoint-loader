'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts[0].js;

// Chrome loads these files in manifest order into one shared isolated world.
// Running them the same way here catches a module that reaches for another
// before it has been defined.
function loadInOrder(files) {
  const listeners = {};
  const context = vm.createContext({
    console,
    setTimeout,
    setInterval: () => 0,
    clearInterval: () => {},
    URL,
    Promise,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    document: {
      readyState: 'complete',
      addEventListener: (name, handler) => {
        listeners[name] = handler;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({
        style: {},
        classList: { toggle() {}, add() {} },
        append() {},
        appendChild() {},
        addEventListener() {},
        attachShadow: () => ({ append() {} }),
        querySelector: () => null,
        remove() {},
      }),
      body: { append() {}, appendChild() {} },
      documentElement: { append() {} },
    },
    location: { href: 'https://contoso.sharepoint.com/sites/team/SitePages/Home.aspx' },
    chrome: { storage: { sync: { get: async () => ({}), set: async () => {} } } },
    fetch: async () => {
      throw new Error('not used');
    },
  });

  for (const file of files) {
    vm.runInContext(readFileSync(join(root, file), 'utf8'), context, { filename: file });
  }

  return context;
}

test('every content script loads in the order the manifest declares', () => {
  const context = loadInOrder(scripts);

  assert.deepStrictEqual(
    Object.keys(context.SPL).sort(),
    [
      'api',
      'crawl',
      'download',
      'exporter',
      'panel',
      'progress',
      'rows',
      'scroll',
      'serialize',
      'settings',
      'url',
    ].sort()
  );
});

test('the manifest lists every content script that exists in src', () => {
  // panel.js reads SPL.settings.defaults at construction time, so a module
  // missing from the manifest would fail only in the browser.
  assert.ok(scripts.includes('src/settings.js'));
  assert.ok(scripts.indexOf('src/rows.js') < scripts.indexOf('src/api.js'));
  assert.ok(scripts.indexOf('src/serialize.js') < scripts.indexOf('src/export.js'));
  assert.ok(scripts.indexOf('src/crawl.js') < scripts.indexOf('src/export.js'));
  assert.ok(scripts.at(-1) === 'src/content.js');
});
