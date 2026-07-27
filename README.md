# SharePoint Loader

A standalone Manifest V3 browser extension that gives you the complete contents
of a SharePoint list. It adds a panel to SharePoint list and document-library
pages that can:

- **Load full list** — progressively scroll the list so SharePoint renders the
  folders, files, and rows it had not loaded yet. This is what makes the page
  itself hold everything, so SharePoint's own select-all and "Download as zip"
  cover the whole library.
- **Export CSV / JSON** — read the list through SharePoint's own REST API and
  save it as a file, using the columns of the view you are looking at. Tick
  **Include subfolders** to walk the whole folder tree and add a folder path
  column.

Progress is reported against the list's real item count where one exists, and
as a running total where it does not. Any run can be stopped, and a run that
fails partway offers to save what it already read.

The panel appears only on pages where a list is actually present.

## How it reads a list

The content script calls SharePoint's documented
[`RenderListDataAsStream`](https://learn.microsoft.com/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
endpoint on the same origin as the page, using the browser's existing
SharePoint session. Requests are read-only, strictly sequential, and back off
when SharePoint throttles. Nothing is sent anywhere else — see
[`docs/chrome-web-store-privacy.md`](docs/chrome-web-store-privacy.md).

## Settings

The options page (the gear icon in the panel, or the extension's entry in
`chrome://extensions`) controls items per request, folder crawl limits, CSV
delimiter and byte order mark, UTC or local dates, and the scrolling timings.

## Supported hosts

- `*.sharepoint.com`
- `*.sharepoint.cn`
- `*.sharepoint.de`
- `*.sharepoint.us`

## Validate, test, and build

Node.js 22 and the `zip` command are required. Validation covers the manifest,
permissions, SharePoint-only matches, version alignment, and that every
packaged file exists; it then runs the test suite:

```sh
npm run check
```

Tests alone:

```sh
npm test
```

The toolbar icons are generated deterministically and committed:

```sh
npm run icons
```

Build the installable archive with:

```sh
npm run build
```

The output is `dist/sharepoint-loader.zip`, containing `manifest.json` at the
archive root alongside `src/` and `icons/`. The file list is derived from the
manifest — including scripts referenced only by the options page — rather than
maintained by hand, so adding a module needs no build change. Generated ZIP
files are ignored by Git.

## Architecture

Each module is a dependency-free file that wraps itself in a shared `SPL`
namespace, so the same file loads as a Chrome classic content script and as a
CommonJS module under `node --test`:

| File | Purpose |
| --- | --- |
| `src/url.js` | Page URL → list, folder, and view identity |
| `src/api.js` | Same-origin fetch, form digest, retry and backoff |
| `src/rows.js` | API responses → rows, columns, continuation tokens |
| `src/crawl.js` | Breadth-first folder walk |
| `src/serialize.js` | Rows → CSV or JSON text, written per page |
| `src/export.js` | Orchestrates a read and hands off the finished chunks |
| `src/progress.js` | Progress state → display text |
| `src/settings.js` | Defaults and `chrome.storage.sync` |
| `src/scroll.js` | The in-page scrolling loader |
| `src/panel.js`, `src/content.js` | Panel UI and entry point |

Content scripts run in an isolated world and cannot read the page's
`_spPageContextInfo`, so list identity is derived entirely from the URL. The
manifest's script order is load-bearing and is covered by a test.

## Manual verification

The unit tests cover everything except the DOM and the network. Before
releasing, confirm against a real tenant:

1. The panel appears on a document library and on a `/Lists/` list, and does
   not appear on a site home page.
2. **Load full list** reaches the bottom of a long library and reports the row
   count; stopping it mid-run reports "Stopped".
3. **Export CSV** on a library produces the view's columns, opens correctly in
   Excel, and matches the item count shown by SharePoint.
4. **Include subfolders** produces a folder path column covering nested
   folders.
5. Paging works beyond one page — verify on a list of more than 500 items that
   the export is complete. This is the behaviour flagged in the design document
   as needing confirmation against a live tenant: the response's `NextHref`
   continuation is observed behaviour rather than documented. If it proves
   unreliable, `SPL.rows.pagingFromLastRow` implements the documented
   `RowLimit` fallback and is already tested.
6. Settings persist across a browser restart.

## Chrome Web Store assets

Publication-ready listing copy and privacy answers are in
[`docs/chrome-web-store-listing.md`](docs/chrome-web-store-listing.md) and
[`docs/chrome-web-store-privacy.md`](docs/chrome-web-store-privacy.md). The
screenshots, icon, and promotional tile are produced by the **Generate store
assets** workflow: run it from **Actions → Generate store assets → Run
workflow**, or take the `store-assets` artifact from the run triggered by a
published release, then download it and upload the PNGs to the Developer
Dashboard.

The artwork is generated in CI rather than locally because
`scripts/generate-store-assets.py` draws with Cairo, loaded through `ctypes`
under its Linux shared-object name `libcairo.so.2`. That name does not resolve
on macOS, which uses `libcairo.2.dylib`, and Cairo is not present there by
default. Hand-declared `ctypes` signatures also fail unsafely if the library's
ABI ever diverges, so pinning the generator to one known environment is worth
more than local convenience. `npm run store-assets` still exists and works on
Linux.

The generated PNG files are intentionally ignored by Git because this
repository's pull-request system does not accept binary files. The extension's
own toolbar icons are unrelated to this: they are committed, and generated by
the dependency-free `npm run icons`.

The generator draws the current panel, and its store icon is built from the
same shapes as the committed toolbar icons, so the two stay consistent.

Before submitting, replace the support-email placeholder in the privacy policy,
publish it at a stable public HTTPS URL, and enter that URL in the Chrome Web
Store Developer Dashboard.

## Local installation (unpacked)

1. Clone or download and extract this repository.
2. Open `chrome://extensions`.
3. Enable Developer Mode.
4. Select **Load unpacked**.
5. Select the repository directory (the directory containing `manifest.json`).

## Releases

The versions in `manifest.json` and `package.json` must always match. Increment
both before releasing. A version change pushed to `main` creates the
`v<version>` GitHub Release; an existing tag causes the workflow to stop and ask
for another version. The release contains exactly the packaged asset
`sharepoint-loader-v<version>.zip`. A matching `v*` tag can also trigger the
release workflow, provided it agrees with the manifest version.

CI runs validation, builds and inspects the ZIP, and uploads it as the
`sharepoint-loader` Actions artifact on every push and pull request.

## Chrome Web Store publication

First create the **SharePoint Loader** item/listing in the Chrome Web Store
Developer Dashboard and obtain its unique extension ID. Do not use the Universal
Toolkit extension ID. Configure OAuth access to the Chrome Web Store API for the
developer account that owns that item. The OAuth client and refresh token may be
shared only when that same developer account is authorized and Google's current
requirements permit it. See Google's official [Chrome Web Store API guide](https://developer.chrome.com/docs/webstore/using-api)
and [OAuth 2.0 web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

After a successful **Release** workflow, **Publish to Chrome Web Store** resolves
the release from the exact triggering commit, downloads and verifies the exact
release asset, uploads it, and requests publication. To retry, open **Actions →
Publish to Chrome Web Store → Run workflow**. Keep **Use latest release** enabled,
or disable it and enter a specific `v<version>` tag. Choose `default` or
`trustedTesters` as the publication target.

Enable `skip_upload` only when that package is already staged in the Web Store,
for example after upload succeeded but review or listing validation prevented
publication. This retries publication without uploading the ZIP again.

### GitHub Actions secrets

`GITHUB_TOKEN` is supplied automatically by GitHub Actions. Configure all other
values as repository secrets—never in workflow inputs or tracked files:

| Secret | Purpose |
| --- | --- |
| `CHROME_EXTENSION_ID` | Unique Web Store item ID assigned to SharePoint Loader; never the Universal Toolkit ID. |
| `CHROME_CLIENT_ID` | OAuth client ID authorized for the Chrome Web Store API. |
| `CHROME_CLIENT_SECRET` | Client secret belonging to that exact OAuth client. |
| `CHROME_REFRESH_TOKEN` | Refresh token generated with the same OAuth client and developer account. |
| `TELEGRAM_BOT_TOKEN` | Optional BotFather bot token. |
| `TELEGRAM_CHAT_ID` | Optional target chat, channel, or group ID. |
| `TELEGRAM_THREAD_ID` | Optional forum-topic ID; omit it to post to the main chat. |

### Generating `CHROME_REFRESH_TOKEN`

```sh
npx chrome-webstore-upload-keys
```

It opens a Google consent screen; sign in as the developer account that owns
the Web Store item. It prints a client ID, client secret, and refresh token.
Store all three as repository secrets — never in a file, a commit, a workflow
input, or a pull-request comment:

```sh
gh secret set CHROME_CLIENT_ID
gh secret set CHROME_CLIENT_SECRET
gh secret set CHROME_REFRESH_TOKEN
```

### OAuth failures

The publish workflow prints Google's own error code. The two differ in cause
and in fix:

| Error | Meaning | Fix |
| --- | --- | --- |
| `invalid_grant` | The refresh token is expired, revoked, or was issued by a different OAuth client. | Regenerate it with the command above. |
| `invalid_client` | `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET` do not belong to the same active OAuth client. | Confirm the pair in Google Cloud Console, then regenerate the refresh token with that client. |

A refresh token for an OAuth client still in *Testing* publishing status expires
after seven days, so a pipeline that worked last week can fail with
`invalid_grant` having changed nothing. Move the client to *In production* to
stop that recurring.

### Publication is automatic

A successful **Release** triggers **Publish to Chrome Web Store** through
`workflow_run`. Once the secrets are valid, bumping the version is therefore
enough to publish — there is no further confirmation step. If you would rather
releases and store submissions be separate decisions, remove the `workflow_run`
trigger from `chrome-web-store-publish.yml` and dispatch it by hand.

### Browser-only secret setup

1. Open <https://github.com/pythongod/sharepoint-loader> in a browser.
2. Open **Settings**.
3. Open **Secrets and variables**.
4. Open **Actions**.
5. Select **New repository secret**.
6. Add each required Chrome secret separately; add each Telegram secret
   separately only if notifications are wanted.

Never request or post a secret in a pull-request comment, issue, commit,
workflow-dispatch input, or README. Telegram notifications are optional; the
publication workflow succeeds without them. The manual **Test Telegram
notification** and **Send ZIP to Telegram** workflows require the bot and chat
secrets when invoked.
