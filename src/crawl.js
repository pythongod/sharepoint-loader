'use strict';

// Breadth-first folder walk. The API is injected rather than imported so the
// walk can be driven by a plain object in tests.
(function (SPL) {
  SPL.crawl = {
    // Resolves to { found, folders, stopped, truncated }. Rows reach the
    // caller through onPage, tagged with the folder they came from, so nothing
    // accumulates here.
    async run(options) {
      const {
        api,
        rootFolder,
        recursive = false,
        maxDepth = Infinity,
        maxFolders = Infinity,
        onPage,
        shouldStop = () => false,
      } = options;

      const queue = [{ folderUrl: rootFolder, depth: 1 }];
      const visited = new Set([rootFolder]);

      let found = 0;
      let folders = 0;
      let stopped = false;
      let truncated = false;

      while (queue.length > 0) {
        if (shouldStop()) {
          stopped = true;
          break;
        }

        if (folders >= maxFolders) {
          truncated = true;
          break;
        }

        const { folderUrl, depth } = queue.shift();

        folders += 1;

        let paging = null;

        do {
          const page = await api.listPage({ folderUrl, paging });
          const pageRows = page.rows || [];

          for (const row of pageRows) {
            row[SPL.rows.FOLDER_KEY] = folderUrl;

            if (!recursive || !SPL.rows.isFolder(row)) continue;

            const child = row.FileRef;

            if (!child || visited.has(child)) continue;

            if (depth >= maxDepth) {
              truncated = true;
              continue;
            }

            visited.add(child);
            queue.push({ folderUrl: child, depth: depth + 1 });
          }

          found += pageRows.length;

          onPage(pageRows, { folder: folderUrl, found });

          paging = page.nextPaging || null;

          if (paging && shouldStop()) {
            stopped = true;
            break;
          }
        } while (paging);

        if (stopped) break;
      }

      if (queue.length > 0 && !stopped) truncated = true;

      return { found, folders, stopped, truncated };
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
