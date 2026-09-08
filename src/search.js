'use strict';

// Finding an item by name. The browser's own find-in-page cannot do this:
// SharePoint virtualises the list and keeps only a window of rows in the
// document, so Ctrl+F searches a few dozen rows no matter how far the page has
// been scrolled — Load full list makes SharePoint *fetch* everything, not hold
// it in the DOM. This reads the folder through the same REST endpoint the list
// itself uses, keeps one name and one link per item, and filters that.
(function (SPL) {
  // A ceiling on the index, not on the request: a folder with more items than
  // this is searched as far as it was read, and the panel says so. A name and
  // a link for 20000 items is a few megabytes; a 343000-item library is not.
  const MAX_ENTRIES = 20000;

  // Views name their display field differently — FileLeafRef and LinkFilename
  // in a library, Title and LinkTitle in a list — so the name comes from the
  // first field that carries one, and from the item's own path when none do.
  const NAME_FIELDS = ['FileLeafRef', 'LinkFilename', 'LinkFilenameNoMenu', 'Title', 'LinkTitle'];

  SPL.search = {
    MAX_ENTRIES,

    // Pure. { hits, total } — total counts every match, hits carries at most
    // `limit` of them, so the caller can say "50 of 312" honestly.
    //
    // Every whitespace-separated term must appear in the name, in any order:
    // "data centers" finds NTT_Global_Data_Centers. Names that start with the
    // query come first, because that is the item the typist had in mind.
    matches(entries, query, { limit } = {}) {
      const terms = fold(query).split(/\s+/).filter(Boolean);

      if (terms.length === 0) return { hits: [], total: 0 };

      const found = [];

      for (const entry of entries || []) {
        const name = fold(entry.name);

        if (terms.every((term) => name.includes(term))) {
          found.push({ entry, prefix: name.startsWith(terms[0]) ? 0 : 1, name });
        }
      }

      found.sort(
        (left, right) =>
          left.prefix - right.prefix ||
          left.name.localeCompare(right.name, undefined, { numeric: true })
      );

      const hits = (limit ? found.slice(0, limit) : found).map((match) => match.entry);

      return { hits, total: found.length };
    },

    // Reads the current folder — one page at a time, following SharePoint's
    // own paging — and returns { entries, stopped, truncated }. Only a name, a
    // link, and a folder flag are kept: everything else in a row would make
    // the index far larger than the thing it exists to search.
    async index(options) {
      const {
        api,
        context,
        pageHref,
        settings,
        isLibrary,
        onProgress = () => {},
        shouldStop = () => false,
      } = options;

      const library = isLibrary === undefined ? await libraryFlag(api) : isLibrary;
      const entries = [];

      let full = false;

      const result = await SPL.crawl.run({
        api: {
          listPage: ({ folderUrl, paging }) =>
            api.listPage({
              folderUrl,
              paging,
              viewId: context.viewId,
              pageSize: settings.pageSize,
            }),
        },
        rootFolder: context.folderUrl,
        // The search covers the folder the user is looking at, which is what
        // Ctrl+F would have covered. Subfolders are a separate question.
        recursive: false,
        shouldStop: () => full || shouldStop(),
        onPage(pageRows, state) {
          for (const row of pageRows) {
            if (entries.length >= MAX_ENTRIES) {
              full = true;

              break;
            }

            entries.push(entry(row, context, pageHref, library));
          }

          onProgress({ found: state.found });
        },
      });

      // Hitting the ceiling stops the crawl through the same shouldStop the
      // Stop button uses, so the two have to be told apart here.
      return { entries, stopped: result.stopped && !full, truncated: full };
    },
  };

  function entry(row, context, pageHref, isLibrary) {
    const fileRef = SPL.rows.value(row, 'FileRef');
    const isFolder = SPL.rows.isFolder(row);

    return {
      name: name(row, fileRef),
      isFolder,
      url: href(row, context, pageHref, fileRef, isFolder, isLibrary),
    };
  }

  function name(row, fileRef) {
    for (const field of NAME_FIELDS) {
      const value = SPL.rows.value(row, field);

      if (value) return value;
    }

    return fileRef.split('/').filter(Boolean).pop() || '';
  }

  // A folder opens in the list view; a document opens at its own path. A list
  // item has neither — its FileRef points at an internal .000 path — so it
  // goes to the display form the list itself links to.
  function href(row, context, pageHref, fileRef, isFolder, isLibrary) {
    if (isFolder && fileRef) return SPL.url.folderHref(pageHref, fileRef);
    if (isLibrary) return fileRef ? SPL.url.fileHref(context.origin, fileRef) : null;

    const id = SPL.rows.value(row, 'ID');

    if (!id) return null;

    return `${SPL.url.fileHref(context.origin, context.listUrl)}/DispForm.aspx?ID=${encodeURIComponent(id)}`;
  }

  // A list whose metadata cannot be read is still worth searching; assuming a
  // library only costs a wrong link shape on a generic list.
  async function libraryFlag(api) {
    try {
      return (await api.listInfo()).isLibrary !== false;
    } catch {
      return true;
    }
  }

  // Case and accents should not decide a match: on a German tenant, "muller"
  // has to find "Müller". NFD splits an accented letter into letter plus
  // combining mark, and the mark is then dropped.
  function fold(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }
})((globalThis.SPL = globalThis.SPL || {}));
