# Chrome Web Store privacy disclosure

**Extension name:** SharePoint Loader  
**Extension ID:** Assigned by the Chrome Web Store  
**Last updated:** 2026-07-25

## 1. Single purpose

> To give the user the complete contents of the SharePoint list they are
> viewing: either by loading every item into the page, or by reading the list
> through SharePoint's own API and saving it as a CSV or JSON file on the
> user's device.

Both actions serve the same purpose — a long SharePoint list only ever shows a
fraction of itself, and this extension shows or saves the rest.

## 2. Permission justification

### `storage`

> SharePoint Loader stores only the user's own settings, configured on the
> extension's options page: the number of items requested per API call, folder
> crawl depth and folder-count limits, whether subfolders are included by
> default, the CSV delimiter and byte-order-mark option, whether dates are
> shown in UTC or local time, the timings used when loading a list by
> scrolling, and the light/dark theme preference. `chrome.storage.sync` is used
> so these preferences follow the user between their own signed-in Chrome
> profiles. No list content, file data, browsing history, or personal
> information is written to storage, and nothing stored is transmitted
> anywhere.

This must list everything the extension actually stores. The authoritative
list is `SPL.settings.defaults` in [`src/settings.js`](../src/settings.js);
adding a setting means updating this paragraph in the same change.

### Site access / content-script matches

**Hosts:** `https://*.sharepoint.com/*`, `https://*.sharepoint.cn/*`,
`https://*.sharepoint.de/*`, and `https://*.sharepoint.us/*`

> Access is required to add the extension's control to SharePoint list pages,
> to load the list in the page by scrolling it, and to read the list through
> SharePoint's own REST API on the same site the user is already viewing. The
> extension does not run on other sites. Broad SharePoint subdomain matching is
> needed because each Microsoft 365 tenant uses its own SharePoint subdomain
> and sovereign clouds use the listed country-specific domains.

No host permissions beyond these content-script matches are declared, and the
extension requests no optional permissions.

## 3. Network activity

The extension makes requests to exactly one place: the SharePoint site the user
currently has open. These requests use the user's existing signed-in session,
are same-origin with the page, and call the same documented SharePoint REST
endpoints the SharePoint web interface itself uses to display a list
(`RenderListDataAsStream`, `GetList`, and `contextinfo`). They are read-only.

No data is sent to the developer, to any analytics service, or to any other
third party. The extension contains no remote code, no advertising, and no
accounts.

## 4. Privacy practices answers

Chrome Web Store disclosure uses "collection" to mean transmitting data off the
user's device. SharePoint Loader transmits nothing: it reads the user's own
SharePoint data from the user's own SharePoint tenant and, when the user asks,
writes it to a file on the user's own device.

| Data category | Answer | Explanation |
| --- | --- | --- |
| Personally identifiable information | Not collected | Nothing is transmitted off the device. An exported file may contain names or email addresses held in the user's own list; that file is written only to the user's device, at the user's request. |
| Health information | Not collected | The extension does not store or transmit health data. |
| Financial and payment information | Not collected | The extension does not access or transmit payment data. |
| Authentication information | Not collected | The extension does not read, store, or transmit passwords, credentials, or tokens. Requests rely on the browser's existing SharePoint session cookie, which the extension never reads. |
| Personal communications | Not collected | The extension does not access or transmit communications. |
| Location | Not collected | The extension does not access location data. |
| Web history | Not collected | The extension neither records nor transmits visited URLs or search history. It reads the address of the current page only to identify which list is being viewed. |
| User activity | Not collected | Selecting an action in the extension's own panel starts or stops work locally. Clicks, keystrokes, and browsing behaviour are not recorded or transmitted. |
| Website content | Not collected | The extension reads the current list's items from SharePoint and, on the scrolling path, inspects layout and row markers on the page. This content is processed in the browser and written to a file only when the user selects an export. It is never transmitted anywhere. |

### Required certifications

Select all three certifications in the Privacy practices tab:

- [x] I do not sell or transfer user data to third parties, outside the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## 5. Data handling and retention

- No user data is sold, shared, or transmitted to the developer or any third
  party.
- No analytics, advertisements, remote code, or external services are used.
- `chrome.storage.sync` holds the user's preferences only, listed in section 2.
  Chrome may synchronise these preferences between the user's own signed-in
  Chrome profiles.
- Exported files are written by the browser's ordinary download mechanism to
  wherever the user chooses to save them. The extension keeps no copy.
- List content read during a run exists only in the open page's memory and is
  discarded when the page is closed or reloaded.
- Uninstalling the extension removes the extension code and its stored
  preferences. Files the user already saved are unaffected.

## 6. Privacy policy

**Published at:**
<https://pythongod.github.io/sharepoint-loader/privacy.html>

That page is served by GitHub Pages from [`docs/privacy.html`](privacy.html) on
`main`, so it is versioned with the code and updates when the extension does.
Enter that URL in the Developer Dashboard's privacy-policy field.

The published wording follows; keep the two in step when either changes.

> **SharePoint Loader Privacy Policy**  
> Last updated: July 25, 2026
>
> SharePoint Loader has one purpose: to give you the complete contents of the
> SharePoint list you are viewing. It can load every item into the page, and it
> can save the list to a CSV or JSON file on your device.
>
> The extension does not collect, store, sell, or transmit your personal
> information. It uses no analytics, advertising, remote code, or external
> services, and it sends nothing to the developer.
>
> To read a list, the extension calls SharePoint's own API on the site you
> already have open, using your existing sign-in. These requests are read-only
> and go only to that SharePoint site. On the scrolling path, the extension
> also examines page layout and row markers in order to scroll the list and
> report progress. All of this happens in your browser.
>
> Your preferences — items per request, folder limits, CSV options, date
> handling, and scrolling timings — are stored in your browser profile using
> Chrome's storage, and may sync between your own Chrome profiles. No list
> content is stored.
>
> Files you export are saved by your browser wherever you choose. The extension
> retains no copy of them and no other data. Uninstalling the extension removes
> its code and your stored preferences.
>
> For any privacy question, please open an issue at
> <https://github.com/pythongod/sharepoint-loader/issues>.

The contact point is the public issue tracker rather than an email address, so
no personal address is exposed on the listing. The Developer Dashboard's
privacy-policy field must contain the published HTTPS URL above, not this
repository file's URL.

## 7. Prominent disclosure

**Needed:** No.

The extension does not collect or transmit personal or sensitive user data.
Reading the list the user is already looking at, and saving it only when the
user selects an export, is apparent from the panel and necessary for the
extension's stated purpose.

## 8. Pre-submission checklist

- [x] Give the privacy policy a working contact point — the public issue
      tracker.
- [x] Publish the privacy policy at a stable public HTTPS URL —
      <https://pythongod.github.io/sharepoint-loader/privacy.html>.
- [ ] Enter that URL in the Developer Dashboard.
- [ ] Confirm the assigned extension ID in release/publishing configuration.
- [ ] Regenerate and upload the screenshots and icon from `store-assets/`; the
      previous screenshots show the single-button interface that no longer
      exists.
- [ ] Confirm the declared permissions are still exactly `storage` plus the
      four SharePoint content-script matches.
- [ ] Recheck these answers whenever functionality or permissions change.
