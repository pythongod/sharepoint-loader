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

      const layoutsIndex = segments.indexOf('_layouts');

      // segments[0] is always empty for an absolute path, so a real _layouts
      // segment is never at index 0.
      if (layoutsIndex > 0) return fromLayouts(parsed, segments, layoutsIndex, fileName);

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

  // OneDrive for Business — and, increasingly, SharePoint document libraries —
  // render through /_layouts/15/onedrive.aspx. The path names the web but not
  // the library, so the library comes from the folder in ?id=. Personal sites
  // are the exception: their library is always <web>/Documents, so a bare URL
  // with no id still resolves.
  function fromLayouts(parsed, segments, layoutsIndex, fileName) {
    if (fileName.toLowerCase() !== 'onedrive.aspx') return null;

    const webUrl = segments.slice(0, layoutsIndex).join('/') || '/';
    const prefix = webUrl === '/' ? '' : webUrl;
    const id = parsed.searchParams.get('id');

    let listUrl = null;

    if (id) {
      const folder = id.replace(/\/+$/, '');

      if (folder !== prefix && !folder.startsWith(`${prefix}/`)) return null;

      const [library] = folder.slice(prefix.length).split('/').filter(Boolean);

      if (!library) return null;

      listUrl = `${prefix}/${library}`;
    } else if (webUrl.startsWith('/personal/')) {
      listUrl = `${prefix}/Documents`;
    } else {
      return null;
    }

    return {
      origin: parsed.origin,
      webUrl,
      listUrl,
      folderUrl: folderFrom(id, listUrl),
      viewId: viewIdFrom(parsed.searchParams.get('viewid')),
    };
  }

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
