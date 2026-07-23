# SharePoint Loader

A standalone Manifest V3 browser extension that adds a **Load full list**
button to SharePoint lists.

The button automatically scrolls through a long SharePoint list so that
dynamically rendered folders and files are loaded.

Click the button again while it is running to stop loading.

## Supported hosts

- `*.sharepoint.com`
- `*.sharepoint.cn`
- `*.sharepoint.de`
- `*.sharepoint.us`

## Validate and build

Node.js 22 and the `zip` command are required. Validate the manifest, source,
version alignment, and SharePoint-only matches with:

```sh
npm run check
```

Build the installable archive with:

```sh
npm run build
```

The output is `dist/sharepoint-loader.zip`. It contains `manifest.json` at the
archive root and `src/content.js`; generated ZIP files are ignored by Git.

## Chrome Web Store assets

Publication-ready listing copy and privacy answers are in
[`docs/chrome-web-store-listing.md`](docs/chrome-web-store-listing.md) and
[`docs/chrome-web-store-privacy.md`](docs/chrome-web-store-privacy.md). The
screenshots, icon, and promotional tile are generated in
[`store-assets/`](store-assets/). Generate the PNG artwork deterministically
with:

```sh
npm run store-assets
```

The generated PNG files are intentionally ignored by Git because this
repository's pull-request system does not accept binary files. Run the command
locally immediately before uploading the resulting assets to the Web Store.

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

If OAuth returns `invalid_client`, confirm that `CHROME_CLIENT_ID` and
`CHROME_CLIENT_SECRET` belong to the same active OAuth client, then regenerate
`CHROME_REFRESH_TOKEN` with that client while signed in to the correct Chrome Web
Store developer account.

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
