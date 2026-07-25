'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/settings.js');
const { settings } = globalThis.SPL;

test('exposes the documented defaults', () => {
  assert.deepStrictEqual(settings.defaults, {
    pageSize: 500,
    maxCrawlDepth: 10,
    maxCrawlFolders: 2000,
    csvDelimiter: ',',
    csvBom: true,
    datesInUtc: true,
    includeSubfoldersByDefault: false,
    scrollSettleMs: 2500,
    scrollMaxRunMs: 300000,
  });
});

test('merges stored values over the defaults', () => {
  const merged = settings.merge({ pageSize: 100, csvDelimiter: ';' });

  assert.strictEqual(merged.pageSize, 100);
  assert.strictEqual(merged.csvDelimiter, ';');
  assert.strictEqual(merged.maxCrawlDepth, 10);
});

test('ignores unknown stored keys', () => {
  assert.strictEqual(settings.merge({ nonsense: true }).nonsense, undefined);
});

test('ignores a stored value of the wrong type', () => {
  assert.strictEqual(settings.merge({ pageSize: 'lots' }).pageSize, 500);
  assert.strictEqual(settings.merge({ csvBom: 'yes' }).csvBom, true);
});

test('ignores a null or absent store', () => {
  assert.deepStrictEqual(settings.merge(null), settings.defaults);
  assert.deepStrictEqual(settings.merge(undefined), settings.defaults);
});

test('clamps a page size outside the range SharePoint accepts', () => {
  assert.strictEqual(settings.merge({ pageSize: 0 }).pageSize, 1);
  assert.strictEqual(settings.merge({ pageSize: 99999 }).pageSize, 5000);
});

test('clamps crawl limits to at least one', () => {
  assert.strictEqual(settings.merge({ maxCrawlDepth: 0 }).maxCrawlDepth, 1);
  assert.strictEqual(settings.merge({ maxCrawlFolders: -5 }).maxCrawlFolders, 1);
});

test('rejects a delimiter that is not comma or semicolon', () => {
  assert.strictEqual(settings.merge({ csvDelimiter: '|' }).csvDelimiter, ',');
});

test('does not let merge mutate the defaults', () => {
  settings.merge({ pageSize: 100 });

  assert.strictEqual(settings.defaults.pageSize, 500);
});
