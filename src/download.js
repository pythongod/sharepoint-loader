'use strict';

// Saving a file is a user-initiated action on data the user is already looking
// at, so an object URL and a synthetic click are enough — no downloads
// permission, and nothing leaves the browser.
(function (SPL) {
  const types = {
    csv: 'text/csv;charset=utf-8',
    json: 'application/json;charset=utf-8',
  };

  SPL.download = {
    save(fileName, chunks, format) {
      const url = URL.createObjectURL(new Blob(chunks, { type: types[format] }));
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Revoking immediately can cancel the download in some Chrome versions.
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },

    // "Shared Documents" in /sites/team → sharepoint-Shared Documents-2026-07-25.csv
    fileName(listUrl, format) {
      const leaf = listUrl.split('/').filter(Boolean).pop() || 'list';
      const stamp = new Date().toISOString().slice(0, 10);

      return `${leaf.replace(/[\\/:*?"<>|]/g, '-')}-${stamp}.${format}`;
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
