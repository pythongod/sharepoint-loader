# Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `CHANGELOG.md` serving both audiences — full detail in the repository, a plain-language "What's new" section on the extension's options page — with validation that makes a release without an entry fail.

**Architecture:** The split is structural, not editorial: everything between a `## <version>` heading and the first following `###` is user-facing, and the extension renders exactly that. A pure parser in `src/changelog.js` does the only real logic and is unit-tested; the options page fetches the packaged file and renders the result.

**Tech Stack:** Node 22 (`node:test`, `node:assert`), plain classic scripts sharing the `SPL` global namespace. No dependencies.

## Global Constraints

- **Zero dependencies.** `package.json` must gain neither `dependencies` nor `devDependencies`. No markdown library.
- **No `import`/`export` in `src/*.js`.** `package.json` declares no `type`, so these load as CommonJS under `node --test` and as classic scripts in Chrome. Files wrap themselves:
  ```js
  (function (SPL) { /* … */ })((globalThis.SPL = globalThis.SPL || {}));
  ```
- **Namespace is `SPL`** throughout this repository (`TPL` belongs to the sibling template — never use it here).
- **All prose in the extension and repository is English.** The spec and this plan are German; `CHANGELOG.md`, code comments, and UI strings are English.
- **Manifest script order is load-bearing** and covered by `test/load-order.test.js`. `src/changelog.js` is used only by the options page, so it must NOT be added to `content_scripts`.
- **Run `npm run check` before every commit.** It must pass. Current baseline: 131 tests.
- **Commit style:** imperative subject under 72 characters, body explaining why, ending with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- **Working directory:** `/Users/jack/Developer/sharepoint-loader`.
- Current version in `manifest.json` and `package.json` is `0.3.4`. Do not change it; Task 5 is where the version question is settled.

---

### Task 1: The parser

**Files:**
- Create: `src/changelog.js`
- Create: `test/changelog.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `SPL.changelog.highlights(markdown)` returning `Array<{ version: string, date: string|null, lines: string[] }>` in file order. Tasks 3 and 4 depend on exactly these field names.

- [ ] **Step 1: Write the failing test**

Create `test/changelog.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/changelog.test.js`
Expected: FAIL with `Cannot find module '../src/changelog.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/changelog.js`:

```javascript
'use strict';

// Parses CHANGELOG.md into the part meant for users. The split is structural:
// everything between a "## <version>" heading and the first following "###" is
// user-facing, so nothing has to be marked up per line and the two audiences
// cannot drift apart.
(function (SPL) {
  const VERSION_HEADING = /^##\s+([^\s—-]+)\s*(?:[—-]\s*(.+))?$/;

  SPL.changelog = {
    // [{ version, date, lines }] in file order. Input that does not match the
    // shape yields no entry rather than throwing: a malformed changelog must
    // not take the options page down with it.
    highlights(markdown) {
      if (typeof markdown !== 'string') return [];

      const entries = [];

      let current = null;
      let collecting = false;

      for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trim();
        const heading = VERSION_HEADING.exec(line);

        if (heading) {
          current = { version: heading[1], date: heading[2] ? heading[2].trim() : null, lines: [] };
          entries.push(current);
          collecting = true;

          continue;
        }

        // A detail heading ends the user-facing part until the next version.
        if (line.startsWith('###')) {
          collecting = false;

          continue;
        }

        if (!collecting || !current || line === '') continue;

        current.lines.push(line.replace(/^[-*]\s+/, ''));
      }

      return entries;
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/changelog.test.js`
Expected: `# pass 10`, `# fail 0`.

- [ ] **Step 5: Run the full suite**

Run: `npm run check`
Expected: validation passes, 141 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add src/changelog.js test/changelog.test.js
git commit -m "Add the changelog parser

Splits CHANGELOG.md into the part meant for users: everything between a
version heading and the first detail heading. Making the split structural
rather than per-line means the repository view and the in-app view cannot
drift apart, because there is only one file and nothing to keep in sync.

Malformed input returns no entries rather than throwing, so a bad changelog
cannot take the options page down with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Ship and enforce the file

**Files:**
- Create: `CHANGELOG.md`
- Modify: `scripts/package-files.mjs` — the `packageFiles` function's initial `Set`
- Modify: `scripts/validate.mjs` — add a rule after the existing icon check

**Interfaces:**
- Consumes: nothing.
- Produces: `CHANGELOG.md` at the repository root, present in the built ZIP. Task 3 fetches it at runtime.

- [ ] **Step 1: Create `CHANGELOG.md` with the backfilled history**

Written from the git history and the release tags. Each version opens with the user-facing summary; technical notes go under `### Details`.

```markdown
# Changelog

All notable changes to SharePoint Loader. The text above each version's
**Details** section is what the extension shows on its options page; the
details below it are for people working on the code.

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
```

- [ ] **Step 2: Add the file to the package**

In `scripts/package-files.mjs`, the `packageFiles` function currently starts:

```javascript
export function packageFiles(root, manifest) {
  const files = new Set(['manifest.json']);
```

Change that line to include the changelog, and add the comment explaining why it cannot be discovered:

```javascript
export function packageFiles(root, manifest) {
  // manifest.json and CHANGELOG.md are structural: the manifest is the entry
  // point everything else is derived from, and the changelog is fetched at
  // runtime by the options page, so nothing in the manifest ever names it.
  const files = new Set(['manifest.json', 'CHANGELOG.md']);
```

- [ ] **Step 3: Add the validation rule**

In `scripts/validate.mjs`, immediately after the existing line:

```javascript
if (!manifest.icons || !manifest.icons['128']) fail('manifest.json must declare a 128px icon');
```

insert:

```javascript
// A changelog kept by good intentions stops at the third release. Requiring an
// entry for the version being shipped makes CI refuse an undocumented release.
const changelogPath = resolve(root, 'CHANGELOG.md');
let changelog = '';

try {
  changelog = readFileSync(changelogPath, 'utf8');
} catch {
  fail('CHANGELOG.md does not exist');
}

if (!new RegExp(`^##\\s+${manifest.version.replace(/\./g, '\\.')}\\b`, 'm').test(changelog)) {
  fail(`CHANGELOG.md has no "## ${manifest.version}" entry — document the release before shipping it`);
}
```

`readFileSync` and `resolve` are already imported at the top of the file; do not add imports.

- [ ] **Step 4: Verify the rule passes for the current version**

Run: `node scripts/validate.mjs; echo "exit=$?"`
Expected: `Validation passed: Manifest V3, version 0.3.4, 20 packaged file(s), 14 script(s).` and `exit=0`. The file count rises from 19 to 20 because the changelog now ships.

- [ ] **Step 5: Verify the rule actually bites**

A rule never seen failing proves nothing. Bump the manifest to a version with no entry, confirm rejection, then restore.

```bash
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('manifest.json','utf8'));m.version='9.9.9';fs.writeFileSync('manifest.json',JSON.stringify(m,null,2)+'\n')"
node scripts/validate.mjs; echo "exit=$?"
git checkout -- manifest.json
node scripts/validate.mjs; echo "exit=$?"
```

Expected: the first run fails with `CHANGELOG.md has no "## 9.9.9" entry — document the release before shipping it` and `exit=1`; after the restore it passes with `exit=0`. Confirm `git status --porcelain manifest.json` is empty.

- [ ] **Step 6: Verify the file is packaged**

Run: `npm run build && unzip -Z1 dist/sharepoint-loader.zip | grep CHANGELOG.md`
Expected: `CHANGELOG.md`. Without this the options page would fetch a 404 and show an empty section — a failure no test would catch, because tests read the file from disk.

- [ ] **Step 7: Run the full suite**

Run: `npm run check`
Expected: validation passes, 141 tests, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add CHANGELOG.md scripts/package-files.mjs scripts/validate.mjs
git commit -m "Add the changelog and require an entry per release

Backfills 0.1.0 through 0.3.4 from the git history: a changelog that starts at
the next version does not answer which build you are running and what changed
in it.

Two things would otherwise fail silently. The packaged file list is derived
from the manifest, which never names the changelog, so it would not ship and
the options page would fetch a 404. And a changelog maintained by good
intentions stops at the third release, so validation now refuses a version
with no entry.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Render it on the options page

**Files:**
- Modify: `src/options.html` — add a section before the closing `</footer>`'s following `<script>` tags, and a style rule
- Modify: `src/options.js` — add the rendering, called alongside the existing version display

**Interfaces:**
- Consumes: `SPL.changelog.highlights(markdown)` from Task 1; `CHANGELOG.md` in the package from Task 2.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the section markup**

In `src/options.html`, immediately before the `<footer>` element, insert:

```html
    <fieldset>
      <legend>What's new</legend>
      <div id="changelog" class="changelog">Loading…</div>
    </fieldset>
```

- [ ] **Step 2: Add the styles**

In the `<style>` block, immediately after the existing `#saved { color: var(--ok); }` line, insert:

```css
      .changelog h3 {
        margin: 16px 0 4px;
        font-size: 14px;
        font-weight: 600;
      }
      .changelog h3:first-child { margin-top: 0; }
      .changelog .date { color: var(--muted); font-weight: 400; font-size: 13px; }
      .changelog .installed {
        margin-left: 6px;
        padding: 1px 6px;
        border-radius: 10px;
        background: var(--accent);
        color: var(--accent-ink);
        font-size: 11px;
        font-weight: 600;
      }
      .changelog ul { margin: 0; padding-left: 18px; }
      .changelog li { margin: 2px 0; }
      .changelog .empty { color: var(--muted); }
```

- [ ] **Step 3: Add the rendering**

In `src/options.js`, replace the existing version block:

```javascript
  // Read from the manifest so the displayed version cannot drift from the
  // installed one.
  if (globalThis.chrome && chrome.runtime && chrome.runtime.getManifest) {
    document.getElementById('version').textContent = chrome.runtime.getManifest().version;
  }
```

with:

```javascript
  const manifest =
    globalThis.chrome && chrome.runtime && chrome.runtime.getManifest
      ? chrome.runtime.getManifest()
      : null;

  // Read from the manifest so the displayed version cannot drift from the
  // installed one.
  if (manifest) document.getElementById('version').textContent = manifest.version;

  // The five most recent versions are enough to answer "what changed lately";
  // the rest stays in the repository.
  function renderChangelog(entries) {
    const container = document.getElementById('changelog');

    container.textContent = '';

    if (entries.length === 0) {
      container.textContent = 'No changelog available.';
      container.className = 'changelog empty';

      return;
    }

    for (const entry of entries.slice(0, 5)) {
      const heading = document.createElement('h3');

      heading.textContent = entry.version;

      if (entry.date) {
        const date = document.createElement('span');

        date.className = 'date';
        date.textContent = ` — ${entry.date}`;
        heading.append(date);
      }

      // Naming the running build closes the loop with the version in the
      // heading above: which one am I on, and what did it change.
      if (manifest && entry.version === manifest.version) {
        const badge = document.createElement('span');

        badge.className = 'installed';
        badge.textContent = 'installed';
        heading.append(badge);
      }

      container.append(heading);

      if (entry.lines.length === 0) continue;

      const list = document.createElement('ul');

      for (const line of entry.lines) {
        const item = document.createElement('li');

        item.textContent = line;
        list.append(item);
      }

      container.append(list);
    }
  }

  // The settings are this page's job; a changelog that cannot be read must not
  // stop them working.
  async function loadChangelog() {
    if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.getURL) return;

    try {
      const response = await fetch(chrome.runtime.getURL('CHANGELOG.md'));

      if (!response.ok) throw new Error(String(response.status));

      renderChangelog(SPL.changelog.highlights(await response.text()));
    } catch {
      renderChangelog([]);
    }
  }

  loadChangelog();
```

- [ ] **Step 4: Load the parser on the options page**

In `src/options.html`, the script tags at the end currently read:

```html
    <script src="settings.js"></script>
    <script src="options.js"></script>
```

Insert the parser between them, so `SPL.changelog` exists before `options.js` runs:

```html
    <script src="settings.js"></script>
    <script src="changelog.js"></script>
    <script src="options.js"></script>
```

- [ ] **Step 5: Confirm the packager picks up the new script**

Run: `node -e "import('./scripts/package-files.mjs').then(async (m) => { const fs = await import('node:fs'); const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8')); console.log(m.packageFiles(process.cwd(), manifest).join('\n')); })"`
Expected: the list contains `src/changelog.js` and `CHANGELOG.md`. `src/changelog.js` is reachable only through the options page's HTML, so its presence proves the packager followed the reference.

- [ ] **Step 6: Render the page to confirm it looks right**

The options page cannot be opened as an extension page here, so stub `chrome` and serve the changelog from disk. Run from the repository root:

```bash
S=/tmp/changelog-render && rm -rf $S && mkdir -p $S && cp src/*.js src/options.html CHANGELOG.md $S/
python3 - "$S" <<'PY'
import sys, pathlib
d = pathlib.Path(sys.argv[1])
stub = """<script>
globalThis.chrome = {
  storage: { sync: { get: async () => ({}), set: async () => {} } },
  runtime: { getManifest: () => ({ version: '0.3.4' }), getURL: (p) => p },
};
</script>
"""
h = (d / 'options.html').read_text()
h = h.replace('<script src="settings.js"></script>', stub + '    <script src="settings.js"></script>')
(d / 'options.html').write_text(h)
PY
cd $S && python3 -m http.server 8731 >/dev/null 2>&1 &
sleep 2
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --screenshot=/tmp/changelog-render/out.png --window-size=760,1400 \
  "http://localhost:8731/options.html" >/dev/null 2>&1
pkill -f "http.server 8731"
echo "screenshot: /tmp/changelog-render/out.png"
```

A local HTTP server is needed because `fetch` refuses `file://` URLs. Open the screenshot and confirm: the "What's new" section lists five versions newest first, 0.3.4 carries the "installed" badge, dates appear greyed, and no `### Details` content is shown. Then `rm -rf /tmp/changelog-render`.

- [ ] **Step 7: Run the full suite**

Run: `npm run check`
Expected: validation passes, 141 tests, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add src/options.html src/options.js
git commit -m "Show recent changes on the options page

The version shown in the heading says which build is running; this says what
that build changed. Only the part above each version's Details section is
rendered, so the page speaks the user's language while the repository keeps
the full account.

A changelog that cannot be fetched or parsed degrades to a single line rather
than breaking the settings, which are the page's actual job.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Document the convention and release

**Files:**
- Modify: `README.md` — add a section after the "Validate, test, and build" section
- Modify: `manifest.json` and `package.json` — version
- Modify: `CHANGELOG.md` — the new version's entry

**Interfaces:**
- Consumes: everything above.
- Produces: a released 0.4.0.

- [ ] **Step 1: Document the convention in the README**

Insert after the "Validate, test, and build" section, before "Architecture":

```markdown
## Changelog

[`CHANGELOG.md`](CHANGELOG.md) serves two audiences from one file. Each version
opens with a plain-language summary and may follow it with a `### Details`
section:

```markdown
## 1.2.0 — 2026-08-01

What a user notices.

### Details
- What a contributor needs to know.
```

Everything between the version heading and the first `###` is what the
extension shows under **What's new** on its options page. Nothing below it is
rendered there, so implementation notes can be as specific as they need to be.

`npm run check` fails when the version in `manifest.json` has no matching
`## <version>` heading, so a release cannot ship undocumented.
```

- [ ] **Step 2: Bump the version**

The feature is user-visible, so this is a minor bump.

```bash
node -e "const fs=require('fs');for(const f of ['manifest.json','package.json']){const j=JSON.parse(fs.readFileSync(f,'utf8'));j.version='0.4.0';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');}"
```

- [ ] **Step 3: Add the entry for 0.4.0**

Insert directly below the `# Changelog` intro paragraph in `CHANGELOG.md`, above the `## 0.3.4` entry:

```markdown
## 0.4.0 — 2026-07-28

The settings page now shows what changed in recent versions, with the build you
are running marked as installed.

### Details
- `CHANGELOG.md` is the single source: the extension renders only the part
  above each version's `### Details` section, so the two audiences cannot drift
  apart.
- Validation requires an entry for the manifest's version, so an undocumented
  release fails CI.
```

- [ ] **Step 4: Verify the whole thing**

Run: `npm run check && npm run build && unzip -Z1 dist/sharepoint-loader.zip | grep -c .`
Expected: validation passes naming version 0.4.0 and 20 packaged files, 141 tests pass, and the archive lists 20 entries.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md manifest.json package.json
git commit -m "Release 0.4.0 with the changelog convention documented

Records how the one file serves both audiences, so the next person adding an
entry knows where the line between them falls without reading the parser.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage.** Format and the structural split → Task 1 (parser) and Task 2 (the file itself). Components table → Tasks 1–3. Parsing contract → Task 1's tests, including the malformed-input case the spec calls out. Rendering, the five-version limit, the installed marker, and graceful degradation → Task 3. "Two things that would otherwise break" → Task 2 Steps 2, 3, 5 and 6, with Step 5 proving the guard fires and Step 6 proving the file ships. Backfill → Task 2 Step 1. Testing table → Task 1's ten tests, which cover every listed case plus Windows line endings. The deferred panel notification stays out, as the spec requires.

**Placeholder scan.** No `TBD`, no "handle errors appropriately", no "similar to Task N". Every code step carries the literal content, including the exact lines to replace in `options.js` and `package-files.mjs`.

**Type consistency.** `SPL.changelog.highlights(markdown)` is defined in Task 1 and used with that name and shape in Task 3. The fields `version`, `date`, `lines` are identical across the parser, its tests, and the renderer. The namespace is `SPL` throughout — never `TPL`.

**Test-count arithmetic.** The baseline is 131; Task 1 adds ten, so every later step expects 141. If a run reports a different number, something has been added or lost that this plan did not intend.

**Vacuous-check guard.** Task 2 Step 5 exists solely to prove the validation rule fails when it should, rather than passing because nothing exercises it.
