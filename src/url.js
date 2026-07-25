'use strict';

// Derives list identity from the page URL alone. Content scripts run in an
// isolated world and cannot read the page's _spPageContextInfo, so every value
// here comes from the address bar. api.js confirms the result before use.
(function (SPL) {
  const formPages = /^(disp|edit|new|upload)form\.aspx$/i;

  const parentOf = (path) => path.slice(0, path.lastIndexOf('/')) || '/';

  const isViewPage = (fileName) =>
    fileName.toLowerCase().endsWith('.aspx') && !formPages.test(fileName);

  SPL.url = {
    // Returns { origin, webUrl, listUrl, folderUrl, viewId } or null when the
    // URL is not a list view.
    parse(href) {
      let parsed;

      try {
        parsed = new URL(href);
      } catch {
        return null;
      }

      const path = decodeURIComponent(parsed.pathname);
      const segments = path.split('/');
      const fileName = segments[segments.length - 1];

      if (!isViewPage(fileName)) return null;

      let listUrl = null;
      let webUrl = null;

      const formsIndex = segments.lastIndexOf('Forms');

      if (formsIndex > 0 && formsIndex === segments.length - 2) {
        // Document library: <web>/<library>/Forms/<view>.aspx
        listUrl = segments.slice(0, formsIndex).join('/');
        webUrl = parentOf(listUrl);
      } else {
        // List: <web>/Lists/<list>/<view>.aspx
        const listsIndex = segments.lastIndexOf('Lists');

        if (listsIndex < 0 || listsIndex !== segments.length - 3) return null;

        listUrl = segments.slice(0, listsIndex + 2).join('/');
        webUrl = segments.slice(0, listsIndex).join('/') || '/';
      }

      if (!listUrl) return null;

      return {
        origin: parsed.origin,
        webUrl,
        listUrl,
        folderUrl: folderFrom(parsed.searchParams.get('id'), listUrl),
        viewId: viewIdFrom(parsed.searchParams.get('viewid')),
      };
    },
  };

  // SharePoint keeps the current folder in ?id=. An id belonging to a
  // different list means the URL is mid-navigation; fall back to the root.
  function folderFrom(id, listUrl) {
    if (!id) return listUrl;

    const folder = id.replace(/\/+$/, '');

    return folder === listUrl || folder.startsWith(`${listUrl}/`) ? folder : listUrl;
  }

  function viewIdFrom(viewId) {
    if (!viewId) return null;

    return viewId.replace(/[{}]/g, '').trim() || null;
  }
})((globalThis.SPL = globalThis.SPL || {}));
