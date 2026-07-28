# Changelog — technical in the repository, high level in the extension

**Date:** 2026-07-28
**Status:** Approved, ready for implementation

## Summary

One `CHANGELOG.md` at the repository root serves both audiences. Each version
opens with a plain-language summary and may follow it with technical detail.
The extension renders only the plain-language part, in a "What's new" section
on the options page.

The motivating question is a user's: *which version am I running, and what
changed in it?* Version 0.3.4 answered the first half by showing the version in
the toolbar tooltip, the panel, and the options page. This answers the second.

## Goals

1. A changelog readable in the repository, with as much technical detail as a
   contributor needs.
2. A high-level view inside the extension, in the user's language.
3. No drift between the two, by construction rather than by discipline.
4. Releasing without a changelog entry fails the build.

## Non-goals

- A separate `changelog.html` page. The options page already exists, already
  carries the theme and the version, and is where a click on the toolbar icon
  lands since 0.3.4.
- A notification or "what's new" popup after an update. Interrupting someone
  mid-task is a different feature with a different justification.
- A markdown dependency. The user-facing part is deliberately restricted to
  paragraphs and bullet lists so a small parser suffices.
- Changing how versions are decided or released.

## Format

`CHANGELOG.md`, newest version first:

```markdown
## 0.3.4 — 2026-07-28

The version now appears in the toolbar tooltip, the panel, and the settings
page. Clicking the toolbar icon opens the settings.

### Details
- Added `action` with the title set at runtime from
  `chrome.runtime.getManifest()`.
- `chrome.action.onClicked` opens the options page; there is no popup.
```

**The separating rule is mechanical: everything between a `## <version>`
heading and the first following `###` is the user-facing part.** The extension
renders exactly that and nothing below it. No per-line markers, no second list.

Consequences of the rule:

- A version with no technical detail simply has no `###` block.
- A version with nothing worth telling a user still needs a heading, but its
  user-facing part may be a single line saying so.
- The heading format is `## <version>` followed by an optional `— <date>`. The
  version must match `manifest.json` exactly, because validation compares them.

## Components

| File | Responsibility | Pure |
| --- | --- | --- |
| `CHANGELOG.md` | The single source, at the repository root | — |
| `src/changelog.js` | `SPL.changelog.highlights(markdown)` → `[{ version, date, lines }]` | yes |
| `src/options.js` | Fetches the file, renders the section | no |
| `src/options.html` | The "What's new" section markup | — |
| `scripts/validate.mjs` | Fails when the current version has no entry | no |
| `scripts/package-files.mjs` | Includes `CHANGELOG.md` in the package | yes |

`highlights` is the only piece with logic, and it is pure — a string in, an
array out. That is what makes it testable under `node:test` with no browser.

### Parsing contract

`highlights(markdown)` returns one entry per `## ` heading, in file order:

- `version` — the text after `## `, up to a `—`, trimmed.
- `date` — the text after `—`, trimmed, or `null` when absent.
- `lines` — the user-facing content as an array of strings: paragraph lines and
  bullet lines with their `- ` marker removed. Blank lines are dropped.
  Collection stops at the first `###` or the next `##`.

Input that does not match the shape yields no entry rather than throwing: a
malformed changelog must not break the options page.

## Rendering

The options page gains a **What's new** section listing the five most recent
versions. The entry matching the running version is marked as the installed
one, which is the point — it closes the loop with the version shown in the
heading above it.

The file is fetched with `chrome.runtime.getURL('CHANGELOG.md')`. The options
page is an extension page, so it may read packaged files directly; no
`web_accessible_resources` entry is needed, and none is added.

If the fetch fails or the file parses to nothing, the section renders a short
line saying the changelog is unavailable. It never blocks the settings, which
are the page's actual job.

## Two things that would otherwise break

**Packaging.** `packageFiles` derives the shipped file list from the manifest,
and `CHANGELOG.md` appears nowhere in it. Without a change the file would not
ship, the fetch would 404, and the section would be permanently empty — a
failure invisible in every test, because tests read the file from disk. It is
added explicitly alongside `manifest.json`, which is structural for the same
reason.

**Pressure to keep it current.** `validate.mjs` gains a rule: the version in
`manifest.json` must have a matching `## <version>` heading in `CHANGELOG.md`.
`npm run check` fails otherwise, and CI runs `npm run check`, so a release
without an entry cannot merge. This is the same device already used for
permission justifications, chosen for the same reason — a changelog maintained
by good intentions is a changelog that stops at the third release.

## Backfill

Entries for 0.1.0 through 0.3.4 are written from the git history. A changelog
that begins at 0.3.5 does not answer the question that prompted it. Released
versions get dates from their tags; 0.3.3 and 0.3.4 are recorded as released
even though the Web Store rejected the upload while an earlier submission was
in review — the tag exists and the package was cut.

## Testing

`test/changelog.test.js`, using `node:test`:

| Case | Asserts |
| --- | --- |
| Version with date | `version` and `date` split correctly |
| Version without date | `date` is `null` |
| Detail section present | collection stops at the first `###` |
| Consecutive versions | collection stops at the next `##` |
| Bullets and paragraphs | markers stripped, blank lines dropped |
| No user-facing content | entry present with empty `lines` |
| Malformed input | no entry, no throw |
| Ordering | entries returned in file order, newest first |

The rendering and the fetch are not unit-tested, consistent with the rest of
the project: the DOM-touching code is kept thin deliberately. The options page
is verified by rendering it in headless Chrome, as the theme work was.

## Open question deferred

Whether the panel should surface the changelog after an update is deliberately
left out. It is the most visible option and the most intrusive one, and it
should be decided on its own rather than smuggled in with the plumbing.
