# SharePoint Loader — API-backed inventory and export

**Date:** 2026-07-25
**Status:** Approved, ready for implementation planning

## Summary

SharePoint Loader currently injects one floating button that scrolls a
SharePoint list so its virtualized rows render. This design keeps that button
and adds a second, independent capability: reading the current list through
SharePoint's own REST API and exporting it to CSV or JSON, optionally
recursing through subfolders, with honest progress reporting and a settings
page.

Scrolling and the API solve different problems and both are kept:

- **Scrolling** makes the *page* hold every row, which is the only way
  SharePoint's own select-all and "Download as zip" cover a whole library.
- **The API** yields *data* about every item without touching the page, which
  is what export, counts, and folder crawling need.

## Goals

1. Read list contents through `RenderListDataAsStream` instead of scraping the
   DOM.
2. Export the current view's visible columns to CSV or JSON.
3. Report progress against a real item count where one exists, and report
   honestly when one does not.
4. Optionally walk the whole folder tree as part of an export.
5. Provide an options page for the settings these features need.

## Non-goals

- Replacing the scroll feature.
- Microsoft Graph, OAuth, or any authentication the user's existing SharePoint
  session does not already provide.
- Writing to SharePoint. Every request in this design is a read.
- The other defects identified during review: iframe support (`all_frames`),
  the scroller-selection heuristic, the stale scroller reference across SPA
  navigation, oversized scroll steps, and accessibility of the injected UI.
  These remain open and are tracked separately. Two exceptions are folded in
  because leaving them would contradict a goal or block the build: the
  terminal-state fix described under "Honest terminal states", and the missing
  `icons` block, which `validate.mjs` and `build.mjs` must reference anyway.

## Architecture

### Module layout

Each file is dependency-free and wraps itself in a shared namespace, so the
same file loads as a Chrome classic content script *and* as a CommonJS module
under `node --test`:

```js
(function (SPL) {
  SPL.csv = { serialize(rows, columns) { /* … */ } };
})((globalThis.SPL = globalThis.SPL || {}));
```

`package.json` declares no `type`, so `.js` files are CommonJS to Node, while
Chrome loads them as classic scripts sharing one isolated-world global. No
bundler, no dependencies, and `chrome://extensions` → "Load unpacked" keeps
pointing at the repository root.

| File | Purpose | Pure |
| --- | --- | --- |
| `src/url.js` | Page URL → `{ webUrl, listUrl, folderUrl, viewId }` | yes |
| `src/api.js` | Same-origin fetch, form digest, retry/backoff, list metadata, one page of rows | no |
| `src/rows.js` | API response → `{ rows, nextPaging }`; view schema → column set | yes |
| `src/crawl.js` | Breadth-first folder walk; takes its API as a parameter | yes, given an injected API |
| `src/serialize.js` | Rows + columns → CSV text / JSON text | yes |
| `src/download.js` | Blob + anchor click to save a file | no |
| `src/progress.js` | Progress state → display label | yes |
| `src/settings.js` | Defaults (pure) + `chrome.storage.sync` access | mixed |
| `src/scroll.js` | Existing DOM-scroll feature, extracted | no |
| `src/panel.js` | Builds the panel, wires actions, renders progress | no |
| `src/content.js` | Entry point: detect a list, mount the panel | no |
| `src/options.html`, `src/options.js` | Settings page | no |

The impure surface is confined to `api.js`, `download.js`, and the storage half
of `settings.js`. Every module carrying real logic is testable in Node with no
browser and no mocking framework; `crawl.js` receives its API as an argument so
a plain fake object drives it.

### Page identity without page globals

Content scripts run in an isolated world, so `window._spPageContextInfo` is not
visible. Rather than injecting a `world: "MAIN"` script to reach it, `url.js`
derives identity from the page URL alone:

- `?id=` — the current folder's server-relative URL, percent-encoded.
- `?viewid=` — the view GUID.
- The list's server-relative URL — the path with `/Forms/<name>.aspx` stripped
  for document libraries, or the `/Lists/<name>` prefix for lists.

This makes the trickiest parsing in the project a pure function. `api.js`
confirms the derived list URL with a single request before any real work; if
that request fails, the panel falls back to scroll-only mode.

### Manifest and tooling changes

- `content_scripts[0].js` lists the new files in dependency order.
- Add `"permissions": ["storage"]` — no user-facing permission warning.
- Add `options_page` and the `icons` block (currently absent, which is why the
  extension shows a generic puzzle piece).
- `scripts/build.mjs` stops hardcoding two filenames and derives its file list
  from the manifest's own references plus the options page and icons. With
  eleven files a hand-maintained list will drift.
- `scripts/validate.mjs` additionally asserts the options page and icon files
  exist, and that `permissions` stays within an allowlist of `{storage}`, so a
  future permission cannot be added silently. Its existing `allowedMatches`
  check is unchanged — no new hosts are introduced.
- Tests run through `node --test` wired into `npm run check`, so
  `.github/workflows/ci.yml` picks them up with no workflow edit.

## Data flow

### Resolve

Once, on the first action:

```http
GET {web}/_api/web/GetList(@listUrl)?@listUrl='<server-relative list url>'&$select=Id,ItemCount,BaseType
Accept: application/json;odata=nometadata
```

This confirms the list exists and supplies the progress denominator.

### Fetch a page of rows

```http
POST {web}/_api/web/GetList(@listUrl)/RenderListDataAsStream?@listUrl='<server-relative list url>'
Accept: application/json;odata=nometadata
Content-Type: application/json;odata=nometadata
X-RequestDigest: <form digest>

{
  "parameters": {
    "ViewId": "<view guid from the page URL>",
    "DatesInUtc": true,
    "RowLimit": 500,
    "FolderServerRelativeUrl": "<current folder>",
    "Paging": "<continuation, omitted on the first call>"
  }
}
```

`RenderListDataAsStream` is chosen over the OData `/items` endpoint because it
returns exactly the current view's columns with SharePoint's own formatted
display values — lookups, managed metadata, and person fields already resolved
— and honours the view's filters and sort. The OData endpoint returns raw
internal values and would require reimplementing SharePoint's display
formatting plus a separate fetch of the view's `ViewFields`.

The first call adds `"RenderOptions": 4` (`ListSchema`) to obtain the view
schema used for CSV headers.

Requests are made from the content script with `credentials: 'same-origin'`.
Chrome's documented behaviour is that content scripts "initiate requests on
behalf of the web origin that the content script has been injected into and
therefore … are subject to the same origin policy" — the request targets the
same origin as the page, so it is an ordinary same-origin request carrying the
user's session cookies. No service worker proxy, no additional host
permissions, no CORS involvement.

The form digest comes from `POST {web}/_api/contextinfo`, cached for the
returned `FormDigestTimeoutSeconds`.

### Paging

Follow the `NextHref` continuation in each response until it is absent.

**Verification required.** The Microsoft documentation specifies the `Paging`
*request* parameter but does not document the *response* shape. `NextHref` is
observed behaviour. The first implementation task is a spike against a live
tenant to confirm it. If `NextHref` proves unreliable, fall back to
`RowLimit`-based paging: request `RowLimit` rows at a time and use the last
row's ID with a `Paging` value of the form `Paged=TRUE&p_ID=<last id>`,
stopping when a page returns fewer than `RowLimit` rows.

Requests are strictly sequential — one in flight at a time. Parallelism is what
trips SharePoint throttling, and no user-visible latency target justifies it.

### Crawl

A breadth-first queue of folder URLs seeded with the current folder. Rows whose
`FSObjType` is `"1"` are folders and are enqueued; all other rows accumulate.
Depth and total folder count are bounded by settings so a pathological tree
cannot run indefinitely. Visited folder URLs are tracked to guarantee
termination.

The crawl is not a separate feature with its own output. It is the "Include
subfolders" checkbox on export: it makes the export cover the whole tree and
adds a folder-path column. One output shape, one code path.

### Accumulation

Each page is serialized to text and pushed as a string chunk immediately,
rather than retaining row objects. A 200,000-item library then holds formatted
strings instead of a quarter-million objects, and `new Blob(chunks)` produces
the file at the end. JSON export accumulates identically with bracket and comma
framing.

### Progress

- **Determinate** — whole-list export with no folder scope and no view filter:
  progress is against the `ItemCount` obtained during resolve, rendered as
  "1,240 of 8,300".
- **Indeterminate** — folder-scoped, filtered, or recursive runs, where no
  total is knowable up front: rendered as "2,910 found · scanning
  /Archive/2019". No invented percentage.

`ItemCount` on a document library includes folders as well as files, and counts
items across all folders. This is documented in the UI copy rather than
corrected for.

## User interface

The panel mounts **only when `url.js` resolves a list from the page URL**. On a
site home page, a Viva page, or search results it injects nothing. This is
required by the features rather than a cleanup — export and crawl are
meaningless without list identity.

```
┌──────────────────────────────────┐
│ SharePoint Loader           ⚙  ✕ │
├──────────────────────────────────┤
│ Documents · 8,300 items          │
│                                  │
│ [ Load full list ]               │
│ [ Export CSV ]  [ Export JSON ]  │
│ ☐ Include subfolders             │
│                                  │
│ Idle                             │
└──────────────────────────────────┘
```

Collapsed by default to the pill that exists today. The final row is the
progress line. While a run is active the action buttons are replaced by a
single **Stop**, and the progress line shows the `progress.js` label. `✕`
dismisses the panel for the session; `⚙` opens the options page.

SharePoint is a single-page application and changes folders by rewriting `?id=`
without a reload. The panel polls `location.href` every 250 ms and re-resolves
context when it changes — cheap, and independent of however SharePoint routes
internally.

## Settings

Stored in `chrome.storage.sync`. Defaults are a pure object; stored values are
merged over them, so a missing or corrupt key cannot break startup.

| Setting | Default |
| --- | --- |
| Page size (`RowLimit`) | 500 |
| Max crawl depth | 10 |
| Max folders per crawl | 2,000 |
| CSV delimiter | `,` (alternative: `;`) |
| UTF-8 BOM on CSV | on |
| Dates in UTC (vs local) | on |
| Include subfolders by default | off |
| Scroll settle time | 2,500 ms |
| Scroll max run time | 5 minutes |

The semicolon delimiter and the BOM both exist for Excel: European locales
parse semicolon-delimited files correctly, and Excel mangles accented
characters in UTF-8 CSV without a BOM.

The final two settings replace values currently hardcoded at `src/content.js:3`
and `src/content.js:4`.

## Error handling

| Condition | Behaviour |
| --- | --- |
| `401` | "Sign-in expired — reload the page." No retry. |
| `403` | "You do not have permission to read this list." |
| List unresolvable / `404` | Panel runs in scroll-only mode. |
| `429`, `503` | Honour `Retry-After`, else exponential backoff. Panel shows "Throttled — retrying in 12 s". |
| List-view threshold exceeded | Show SharePoint's own message plus the suggestion to switch to the unsorted default view. |
| Network failure | Retry three times, then fail with the underlying message. |

Any mid-run failure offers **Save partial (N items)**. Discarding three minutes
of crawl results is the wrong default.

A view sorted or filtered on a non-indexed column in a list of more than 5,000
items throws SharePoint's list-view-threshold error server-side. This is a
SharePoint constraint, surfaced rather than worked around.

### Honest terminal states

A scroll run that hits the maximum run time currently reports "List loaded"
(`src/content.js:143`), because only the `cancelled` flag is checked. Truthful
progress is the point of goal 3, so the extracted `scroll.js` reports "Stopped
at time limit" for that case. This is the one previously identified defect
folded into this work, because leaving it would directly contradict a goal.

## Testing

`node --test`, no dependencies, wired into `npm run check`.

| File | Covers |
| --- | --- |
| `test/url.test.js` | Library roots, percent-encoded `id=` subfolders, `/Lists/` lists, `viewid`, `/teams/` paths, `-my` hosts, and URLs that resolve to no list |
| `test/rows.test.js` | Response → rows and continuation, absent `NextHref`, schema → column set |
| `test/serialize.test.js` | RFC 4180 escaping (quotes, embedded commas, embedded newlines), delimiter selection, BOM, JSON framing, formula-injection guard |
| `test/crawl.test.js` | Nested trees against a fake API, depth cap, folder cap, cancellation, repeated-folder termination |
| `test/progress.test.js` | Determinate and indeterminate labels, thousands separators, singular/plural |
| `test/settings.test.js` | Defaults merged over partial, unknown, and corrupt stored values |

The formula-injection guard prefixes exported values beginning with `=`, `+`,
`-`, or `@` so SharePoint text cannot execute as a formula when the CSV is
opened in Excel.

There are no browser or end-to-end tests. The DOM-touching modules are kept
deliberately thin, and a manual verification checklist in the README covers
them alongside the live-tenant paging spike.

## Chrome Web Store documentation

The current listing and privacy documents assert three things this work
invalidates: a single purpose of "progressively scrolls the list", that the
extension "makes no external network requests", and that "no user data is
persisted in extension storage".

- **Single purpose**, rewritten: give the user the complete contents of the
  SharePoint list they are viewing — in the page, and as a file.
- **Permissions**: justify `storage` as settings-only, holding no user data.
- **Privacy table**: state that the extension makes network requests only to
  the SharePoint site being viewed, using the user's own existing session; that
  nothing is transmitted to the developer or any third party; that exported
  files are written only where the user chooses to save them; and that
  `chrome.storage.sync` holds preferences only.
- **Section 5 policy text** and the listing summary and description get the
  same rewrite, and the reviewer notes gain steps for testing export.
- The two screenshots produced by `scripts/generate-store-assets.py` depict a
  UI that will no longer exist and must be regenerated.

## Implementation sequencing

1. **Spike:** confirm `RenderListDataAsStream` paging against a live tenant
   before anything else is built. Everything downstream depends on it.
2. Module extraction and the namespace pattern, with `scroll.js` moved
   unchanged apart from the terminal-state fix.
3. `url.js` and its tests.
4. `api.js`, `rows.js`, and paging.
5. `serialize.js`, `download.js`, and CSV/JSON export of a single folder.
6. `crawl.js` and the "Include subfolders" path.
7. `progress.js` and the panel.
8. `settings.js` and the options page.
9. Manifest, `build.mjs`, and `validate.mjs` updates.
10. Store listing and privacy document rewrite; regenerate screenshots.
