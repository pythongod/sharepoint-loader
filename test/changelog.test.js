'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/changelog.js');
const { changelog } = globalThis.SPL;

test('reads a version and its date', () => {
  const [entry] = changelog.highlights('## 0.3.4 — 2026-07-28\n\nShows the version.\n');

  assert.strictEqual(entry.version, '0.3.4');
  assert.strictEqual(entry.date, '2026-07-28');
  assert.deepStrictEqual(entry.lines, ['Shows the version.']);
});

test('reports a missing date as null', () => {
  const [entry] = changelog.highlights('## 0.3.4\n\nShows the version.\n');

  assert.strictEqual(entry.version, '0.3.4');
  assert.strictEqual(entry.date, null);
});

test('stops collecting at the first detail heading', () => {
  const [entry] = changelog.highlights(
    '## 0.3.4 — 2026-07-28\n\nUser facing.\n\n### Details\n- Internal note.\n'
  );

  assert.deepStrictEqual(entry.lines, ['User facing.']);
});

test('stops collecting at the next version', () => {
  const entries = changelog.highlights(
    '## 0.3.4\n\nNewer.\n\n## 0.3.3\n\nOlder.\n'
  );

  assert.deepStrictEqual(entries.map((entry) => entry.lines), [['Newer.'], ['Older.']]);
});

test('strips bullet markers and drops blank lines', () => {
  const [entry] = changelog.highlights(
    '## 0.3.4\n\nA paragraph.\n\n- First point.\n- Second point.\n\n'
  );

  assert.deepStrictEqual(entry.lines, ['A paragraph.', 'First point.', 'Second point.']);
});

test('keeps a version whose user-facing part is empty', () => {
  const [entry] = changelog.highlights('## 0.3.4\n\n### Details\n- Internal only.\n');

  assert.strictEqual(entry.version, '0.3.4');
  assert.deepStrictEqual(entry.lines, []);
});

test('returns entries in file order', () => {
  const entries = changelog.highlights('## 0.3.4\n\nNewer.\n\n## 0.3.3\n\nOlder.\n');

  assert.deepStrictEqual(entries.map((entry) => entry.version), ['0.3.4', '0.3.3']);
});

test('ignores prose before the first version', () => {
  const entries = changelog.highlights('# Changelog\n\nAll notable changes.\n\n## 0.3.4\n\nReal.\n');

  assert.strictEqual(entries.length, 1);
  assert.deepStrictEqual(entries[0].lines, ['Real.']);
});

test('returns nothing for input with no versions rather than throwing', () => {
  assert.deepStrictEqual(changelog.highlights('# Changelog\n\nNothing yet.\n'), []);
  assert.deepStrictEqual(changelog.highlights(''), []);
  assert.deepStrictEqual(changelog.highlights(null), []);
});

test('tolerates windows line endings', () => {
  const [entry] = changelog.highlights('## 0.3.4 — 2026-07-28\r\n\r\nShows the version.\r\n');

  assert.strictEqual(entry.date, '2026-07-28');
  assert.deepStrictEqual(entry.lines, ['Shows the version.']);
});

test('accepts an en dash as a separator', () => {
  const [entry] = changelog.highlights('## 0.3.4 – 2026-07-28\n\nWorks with en dash.\n');

  assert.strictEqual(entry.version, '0.3.4');
  assert.strictEqual(entry.date, '2026-07-28');
});

test('accepts an ascii hyphen as a separator', () => {
  const [entry] = changelog.highlights('## 0.3.4 - 2026-07-28\n\nWorks with hyphen.\n');

  assert.strictEqual(entry.version, '0.3.4');
  assert.strictEqual(entry.date, '2026-07-28');
});

test('parses a prerelease version correctly', () => {
  const [entry] = changelog.highlights('## 0.3.4-beta — 2026-07-28\n\nPrerelease entry.\n');

  assert.strictEqual(entry.version, '0.3.4-beta');
  assert.strictEqual(entry.date, '2026-07-28');
});
