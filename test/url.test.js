'use strict';

const test = require('node:test');
const assert = require('node:assert');

require('../src/url.js');
const { url } = globalThis.SPL;

test('resolves a document library root view', () => {
  assert.deepStrictEqual(
    url.parse('https://contoso.sharepoint.com/sites/team/Shared%20Documents/Forms/AllItems.aspx'),
    {
      origin: 'https://contoso.sharepoint.com',
      webUrl: '/sites/team',
      listUrl: '/sites/team/Shared Documents',
      folderUrl: '/sites/team/Shared Documents',
      viewId: null,
    }
  );
});

test('resolves the folder from the id parameter', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/sites/team/Shared%20Documents/Forms/AllItems.aspx' +
      '?id=%2Fsites%2Fteam%2FShared%20Documents%2FReports%2F2019&viewid=1a2b3c4d-0000-0000-0000-000000000001'
  );

  assert.strictEqual(parsed.listUrl, '/sites/team/Shared Documents');
  assert.strictEqual(parsed.folderUrl, '/sites/team/Shared Documents/Reports/2019');
  assert.strictEqual(parsed.viewId, '1a2b3c4d-0000-0000-0000-000000000001');
});

test('strips braces from a view id', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/sites/team/Shared%20Documents/Forms/AllItems.aspx' +
      '?viewid=%7B1a2b3c4d-0000-0000-0000-000000000001%7D'
  );

  assert.strictEqual(parsed.viewId, '1a2b3c4d-0000-0000-0000-000000000001');
});

test('resolves a list, whose web is the segment before /Lists/', () => {
  const parsed = url.parse('https://contoso.sharepoint.com/sites/team/Lists/Tasks/AllItems.aspx');

  assert.strictEqual(parsed.webUrl, '/sites/team');
  assert.strictEqual(parsed.listUrl, '/sites/team/Lists/Tasks');
});

test('resolves a list on a subsite', () => {
  const parsed = url.parse('https://contoso.sharepoint.com/sites/team/hr/Lists/Absence/AllItems.aspx');

  assert.strictEqual(parsed.webUrl, '/sites/team/hr');
  assert.strictEqual(parsed.listUrl, '/sites/team/hr/Lists/Absence');
});

test('resolves a library on a subsite', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/sites/team/hr/Policies/Forms/AllItems.aspx'
  );

  assert.strictEqual(parsed.webUrl, '/sites/team/hr');
  assert.strictEqual(parsed.listUrl, '/sites/team/hr/Policies');
});

test('resolves a library at the root web', () => {
  const parsed = url.parse('https://contoso.sharepoint.com/Shared%20Documents/Forms/AllItems.aspx');

  assert.strictEqual(parsed.webUrl, '/');
  assert.strictEqual(parsed.listUrl, '/Shared Documents');
});

test('resolves a personal OneDrive library', () => {
  const parsed = url.parse(
    'https://contoso-my.sharepoint.com/personal/ada_contoso_com/Documents/Forms/AllItems.aspx'
  );

  assert.strictEqual(parsed.webUrl, '/personal/ada_contoso_com');
  assert.strictEqual(parsed.listUrl, '/personal/ada_contoso_com/Documents');
});

test('resolves a library under a teams-provisioned site', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/teams/marketing/Shared%20Documents/Forms/AllItems.aspx'
  );

  assert.strictEqual(parsed.webUrl, '/teams/marketing');
  assert.strictEqual(parsed.listUrl, '/teams/marketing/Shared Documents');
});

test('accepts any view page name under Forms', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/sites/team/Shared%20Documents/Forms/Thumbnails.aspx'
  );

  assert.strictEqual(parsed.listUrl, '/sites/team/Shared Documents');
});

test('returns null for a site page', () => {
  assert.strictEqual(
    url.parse('https://contoso.sharepoint.com/sites/team/SitePages/Home.aspx'),
    null
  );
});

test('returns null for a site root', () => {
  assert.strictEqual(url.parse('https://contoso.sharepoint.com/sites/team'), null);
});

test('returns null for a list form rather than a view', () => {
  assert.strictEqual(
    url.parse('https://contoso.sharepoint.com/sites/team/Lists/Tasks/DispForm.aspx?ID=4'),
    null
  );
});

test('ignores an id parameter belonging to a different list', () => {
  const parsed = url.parse(
    'https://contoso.sharepoint.com/sites/team/Shared%20Documents/Forms/AllItems.aspx' +
      '?id=%2Fsites%2Fteam%2FOther%20Library%2FReports'
  );

  assert.strictEqual(parsed.folderUrl, '/sites/team/Shared Documents');
});
