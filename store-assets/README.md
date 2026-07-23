# Chrome Web Store assets

This directory is the output location for publication-ready SharePoint Loader
artwork. Run `npm run store-assets` from the repository root to generate it.

| File | Dimensions | Web Store use |
| --- | ---: | --- |
| `icon-128.png` | 128 × 128 | Store icon |
| `screenshot-load-full-list.png` | 1280 × 800 | Screenshot 1 |
| `screenshot-loading-progress.png` | 1280 × 800 | Screenshot 2 |
| `small-promo-tile.png` | 440 × 280 | Small promotional tile |

The generated PNG files are ignored by Git because the repository's
pull-request system does not support binary files. The screenshots are
representative mockups: they intentionally use generic file and site names and
contain no customer or production SharePoint data. Keep the generated files at
their current dimensions when uploading them.
