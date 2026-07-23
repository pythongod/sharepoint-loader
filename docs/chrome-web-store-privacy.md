# Chrome Web Store privacy disclosure

**Extension name:** SharePoint Loader  
**Extension ID:** Assigned by the Chrome Web Store  
**Last updated:** 2026-07-23

## 1. Single purpose

> To load every dynamically rendered item in the SharePoint list currently
> being viewed by progressively scrolling that list after the user selects the
> **Load full list** button.

## 2. Permission justification

The extension requests no optional Chrome API permissions.

### Site access / content-script matches

**Hosts:** `https://*.sharepoint.com/*`, `https://*.sharepoint.cn/*`,
`https://*.sharepoint.de/*`, and `https://*.sharepoint.us/*`

> Access is required to add the **Load full list** control to SharePoint pages,
> identify the page's scrollable list, count rendered list rows for progress,
> and scroll that list after a user click. The extension does not run on other
> sites. Broad SharePoint subdomain matching is needed because each Microsoft
> 365 tenant uses its own SharePoint subdomain and sovereign clouds use the
> listed country-specific domains.

## 3. Privacy practices answers

Chrome Web Store disclosure uses “collection” to mean transmitting data off the
user's device. SharePoint Loader processes the current page locally and makes
no external network requests.

| Data category | Answer | Explanation |
| --- | --- | --- |
| Personally identifiable information | Not collected | No names, email addresses, identifiers, or account details are stored or transmitted. |
| Health information | Not collected | The extension does not store or transmit health data. |
| Financial and payment information | Not collected | The extension does not access or transmit payment data. |
| Authentication information | Not collected | The extension does not access passwords, credentials, or tokens. |
| Personal communications | Not collected | The extension does not access or transmit communications. |
| Location | Not collected | The extension does not access location data. |
| Web history | Not collected | The extension neither records nor transmits visited URLs or search history. |
| User activity | Not collected | A click on the extension's own injected button starts or stops loading locally; clicks, keystrokes, and browsing behavior are not recorded or transmitted. |
| Website content | Not collected | The extension locally inspects layout, rendered list-row markers, and scroll dimensions on the current SharePoint page solely to scroll the list and display progress. Page content never leaves the browser. |

### Required certifications

Select all three certifications in the Privacy practices tab:

- [x] I do not sell or transfer user data to third parties, outside the approved use cases.
- [x] I do not use or transfer user data for purposes unrelated to the item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## 4. Data handling and retention

- No user data is sold, shared, or transmitted.
- No analytics, advertisements, remote code, or external APIs are used.
- No user data is persisted in extension storage.
- Temporary DOM measurements and row counts exist only in the open page's
  memory and disappear when the page is closed or reloaded.
- Uninstalling the extension removes the extension code; there is no retained
  user data to delete.

## 5. Privacy policy text

Publish the following text at a stable, publicly accessible HTTPS URL and enter
that URL in the Developer Dashboard:

> **SharePoint Loader Privacy Policy**  
> Last updated: July 23, 2026
>
> SharePoint Loader has one purpose: after you select **Load full list**, it
> progressively scrolls the SharePoint list you are viewing so SharePoint can
> render its remaining items.
>
> The extension does not collect, store, sell, or transmit personal information
> or other user data. It does not use analytics, advertising, remote code, or
> external services. On supported SharePoint pages, it locally examines DOM
> layout, scroll dimensions, and rendered row markers to find and scroll the
> current list and show an item count. This processing occurs only in your
> browser; page content and browsing activity are never sent elsewhere.
>
> The extension retains no user data. Closing or reloading the page clears the
> temporary in-page state used by an active loading run. Uninstalling the
> extension removes the extension code.
>
> For privacy questions, contact: **[INSERT SUPPORT EMAIL BEFORE PUBLISHING]**

Replace the bracketed support address and publish the policy before submission.
The Web Store listing's privacy-policy field must contain the resulting public
URL, not this repository file's URL unless it is served as an HTTPS web page.

## 6. Prominent disclosure

**Needed:** No.

The extension does not collect or transmit personal or sensitive user data.
Its limited, local interaction with the current SharePoint list is apparent
from the injected button and is necessary for the extension's stated purpose.

## 7. Pre-submission checklist

- [ ] Replace the privacy policy's support-email placeholder.
- [ ] Publish the privacy policy at a stable public HTTPS URL.
- [ ] Enter that URL in the Developer Dashboard.
- [ ] Confirm the assigned extension ID in release/publishing configuration.
- [ ] Upload the screenshots and icon from `store-assets/`.
- [ ] Recheck these answers whenever functionality or permissions change.

