# Changelog

All notable changes to SharePoint Loader. The text above each version's
**Details** section is what the extension shows on its options page; the
details below it are for people working on the code.

## 0.4.0 — 2026-07-28

The settings page now shows what changed in recent versions, with the build you
are running marked as installed.

### Details
- `CHANGELOG.md` is the single source: the extension renders only the part
  above each version's `### Details` section, so the two audiences cannot drift
  apart.
- Validation requires an entry for the manifest's version, so an undocumented
  release fails CI.

## 0.3.4 — 2026-07-28

The version number now appears in the toolbar tooltip, in the panel, and on the
settings page, so you can tell which build you are running. Clicking the
toolbar icon opens the settings.

### Details
- Added an `action` entry to the manifest. Its title is set at runtime from
  `chrome.runtime.getManifest()` rather than written into `default_title`,
  which would need updating by hand on every release.
- `chrome.action.onClicked` opens the options page. There is no popup, so the
  click previously did nothing at all.

## 0.3.3 — 2026-07-28

While scrolling, the panel now says how many rows SharePoint has drawn rather
than implying that is the whole list. A run that fetched 305 items used to
report 72, because SharePoint only ever keeps part of a long list on screen.
When scrolling finishes, the panel points at the list's header checkbox, which
selects everything.

### Details
- `progress.js` gained a `rendered` state; a test asserts a rendered count is
  never paired with a total, which would be the same overstatement reshaped.
- The README and store listing carried the same claim and were corrected.

## 0.3.2 — 2026-07-28

The panel no longer appears over an open Word, Excel, or PowerPoint document.
It belongs on list and library views, not on a document you are reading.

### Details
- Opening a file keeps the view's URL but repoints `id` at the file and adds
  `parent`. `url.parse` read that file path as the current folder, so an export
  would have tried to list a file.
- `parent` is the decisive signal rather than the `id`'s file extension,
  because a folder may legitimately be named `v1.2`.

## 0.3.1 — 2026-07-28

No user-visible change. Released and superseded without reaching the store.

### Details
- The package was byte-identical to 0.3.0; the Web Store refused the upload
  with `ITEM_NOT_UPDATABLE` while 0.3.0 was in review.

## 0.3.0 — 2026-07-25

The panel now appears on OneDrive and on library views that open through
SharePoint's newer file interface. Light and dark themes were added, following
your system by default, with an explicit choice on the settings page.

### Details
- `_layouts/15/onedrive.aspx` resolves the library from the `id` parameter,
  since the path names the web but no list.
- Colours moved into custom properties so the dark palette is one override
  rather than a second stylesheet.
- Fixed the Stop and Save partial rows being permanently visible: `.actions`
  sets `display`, which outranks the user-agent `[hidden]` rule.

## 0.2.0 — 2026-07-25

Added exporting. Alongside loading a list in the page, the panel can now save
the whole list as CSV or JSON, optionally walking every subfolder. Progress is
counted against the list's real size where that is knowable.

### Details
- Reads through SharePoint's own `RenderListDataAsStream` endpoint, same-origin
  with the page and using the existing session; requests are read-only.
- Split into dependency-free modules sharing an `SPL` namespace, loadable both
  as content scripts and as CommonJS under `node --test`.
- Export exposes the view's visible columns with SharePoint's formatted values.

## 0.1.0 — 2026-07-23

First release. Adds a **Load full list** button to SharePoint lists that scrolls
through a long list so the items it had not loaded yet are fetched.
