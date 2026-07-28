# Chrome Web Store listing

Use the following copy and artwork when creating or updating the **SharePoint
Loader** Chrome Web Store item.

## Listing details

**Name** (45-character limit)

> SharePoint Loader

**Summary** (132-character limit)

> Load a long SharePoint list completely, or export the whole list to CSV or JSON.

**Detailed description**

> A long SharePoint list never shows you all of itself. SharePoint Loader gives
> you the rest of it.
>
> On a SharePoint list or document library, a small panel appears in the lower
> right with two things it can do:
>
> **Load full list** — progressively scrolls the list so SharePoint fetches the
> folders, files, and rows it had not loaded yet. Use this when you want to
> select everything in the page, for example before "Download as zip". The
> count shown while it runs is how many rows SharePoint is currently drawing,
> which is fewer than it has fetched — the list only ever keeps part of itself
> on screen. When it finishes, the list's own header checkbox selects
> everything.
>
> **Export CSV / Export JSON** — reads the list through SharePoint's own API
> and saves it as a file. The export contains the columns of the view you are
> looking at, with the same values SharePoint displays. Tick **Include
> subfolders** to cover an entire folder tree and add a folder path column.
>
> While a run is going, the panel shows progress and can be stopped at any
> time. If something fails partway through a long run, the extension offers to
> save what it already read.
>
> Settings — items per request, folder limits, CSV delimiter and byte order
> mark, UTC or local dates, and the scrolling timings — are on the extension's
> options page.
>
> SharePoint Loader is intentionally focused:
>
> • Works only on supported SharePoint domains  
> • Runs only when you select an action  
> • Reads only the SharePoint site you already have open, using your existing
>   sign-in, and only ever reads — it never writes to SharePoint  
> • Sends nothing to the developer or any third party  
> • No analytics, advertising, accounts, or remote code
>
> Supported SharePoint hosts include sharepoint.com, sharepoint.cn,
> sharepoint.de, and sharepoint.us.
>
> SharePoint Loader is an independent utility and is not affiliated with,
> endorsed by, or sponsored by Microsoft. Microsoft and SharePoint are
> trademarks of the Microsoft group of companies.

**Category:** Productivity

**Language:** English

## Artwork

Artwork is produced by the **Generate store assets** workflow, which runs the
Cairo-based generator on Linux and uploads the PNGs as the `store-assets`
build artifact. Run it from **Actions → Generate store assets → Run workflow**,
or take the artifact from the run triggered by the release, then download and
upload the files to the Developer Dashboard. It is not generated locally: the
generator loads Cairo by its Linux shared-object name and will not run on
macOS or Windows.

The screenshots depict the current panel, including the export actions and the
"Include subfolders" option. The store icon is drawn from the same shapes as
the extension's toolbar icon, so the two match.

Upload order:

1. `screenshot-panel.png` — "Load the whole list, or export it"
2. `screenshot-export-progress.png` — "Real progress, and stop whenever"
3. `icon-128.png` — store icon
4. `small-promo-tile.png` — optional small promotional tile

## Reviewer notes

> To test the extension, open a modern SharePoint list or document library on
> one of the declared SharePoint hosts. A **SharePoint Loader** control appears
> in the lower-right corner; select it to open the panel. The panel appears
> only on list and library pages, not on other SharePoint pages.
>
> **Load full list** progressively scrolls the list in the page and reports how
> many rows SharePoint currently has rendered — deliberately not a total, since
> the list keeps only a window of rows on screen no matter how many it has
> fetched. It stops when the list settles, when the configured time limit is
> reached, or when you select Stop.
>
> **Export CSV** and **Export JSON** read the list using SharePoint's own REST
> API (`RenderListDataAsStream`) on the same site, with the signed-in user's
> session, and save the result as a file. These requests are read-only. Tick
> **Include subfolders** first to walk the whole folder tree. Progress shows
> the item count, against the list's total item count when the export covers
> the whole list.
>
> The gear icon opens the options page, which stores preferences using the
> `storage` permission. No other permissions are requested and no data is sent
> anywhere other than the SharePoint site being viewed.
