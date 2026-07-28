'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/progress.js');
const { progress } = globalThis.SPL;

test('reports found and total when a total is known', () => {
  assert.strictEqual(progress.label({ found: 1240, total: 8300 }), '1,240 of 8,300');
});

test('reports only the count when no total is known', () => {
  assert.strictEqual(progress.label({ found: 2910 }), '2,910 found');
});

test('names the folder being scanned', () => {
  assert.strictEqual(
    progress.label({ found: 2910, folder: '/sites/team/Docs/Archive/2019' }),
    '2,910 found · scanning Archive/2019'
  );
});

test('does not invent a total while crawling', () => {
  const label = progress.label({ found: 10, total: 8300, folder: '/sites/team/Docs/Archive' });

  assert.strictEqual(label, '10 found · scanning Docs/Archive');
});

test('uses the singular for one item', () => {
  assert.strictEqual(progress.label({ found: 1 }), '1 found');
});

// Scrolling counts rows present in the page, which SharePoint's virtualised
// list keeps to a window — far fewer than the items it has actually fetched.
// Calling that "found" or "loaded" overstates it: a run that fetched 305
// items reported 72.

test('describes scrolled rows as rendered, not found', () => {
  assert.strictEqual(progress.label({ rendered: 72 }), '72 rows rendered');
});

test('uses the singular for one rendered row', () => {
  assert.strictEqual(progress.label({ rendered: 1 }), '1 row rendered');
});

test('groups thousands in the rendered count', () => {
  assert.strictEqual(progress.label({ rendered: 1240 }), '1,240 rows rendered');
});

test('reports a stopped scroll by what was rendered', () => {
  assert.strictEqual(progress.label({ rendered: 72, stopped: true }), 'Stopped · 72 rows rendered');
});

test('never claims a rendered row count is a total', () => {
  // total belongs to the API path, where it is real; it must not leak into
  // the scroll wording and imply 72 of 305 were "loaded".
  assert.strictEqual(progress.label({ rendered: 72, total: 305 }), '72 rows rendered');
});

test('reports the idle state', () => {
  assert.strictEqual(progress.label({}), 'Idle');
});

test('reports a completed run against its total', () => {
  assert.strictEqual(
    progress.label({ found: 8300, total: 8300, done: true }),
    'Done · 8,300 items'
  );
});

test('reports a throttled run with its retry delay', () => {
  assert.strictEqual(
    progress.label({ found: 500, retryInSeconds: 12 }),
    'Throttled — retrying in 12 s · 500 found'
  );
});

test('reports a stopped run', () => {
  assert.strictEqual(progress.label({ found: 500, stopped: true }), 'Stopped · 500 found');
});
