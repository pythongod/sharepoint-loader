'use strict';

// Orchestrates a read: walk the list, serialize each page as it arrives, and
// hand the finished chunks to the caller's save function. Holds no rows — only
// the text produced from them.
(function (SPL) {
  SPL.exporter = {
    async run({ api, context, settings, format, recursive, onProgress, shouldStop, save }) {
      const info = await listInfo(api);

      // A total is only honest for a whole-list read. A crawl or a
      // folder-scoped view covers an unknown subset of it.
      const scoped = recursive || context.folderUrl !== context.listUrl;
      const total = scoped ? undefined : info.itemCount;

      const chunks = [];

      let writer = null;
      let found = 0;

      const openWriter = (columns) => {
        writer = SPL.serialize[format]({
          columns,
          delimiter: settings.csvDelimiter,
          bom: settings.csvBom,
          pathColumn: recursive ? 'Folder' : null,
        });

        chunks.push(writer.header());
      };

      // Only the first request carries the schema; crawl.js is unaware of it.
      let schemaRequested = false;

      const readingApi = {
        async listPage({ folderUrl, paging }) {
          const page = await api.listPage({
            folderUrl,
            paging,
            viewId: context.viewId,
            pageSize: settings.pageSize,
            datesInUtc: settings.datesInUtc,
            withSchema: !schemaRequested,
          });

          if (!schemaRequested) {
            schemaRequested = true;

            openWriter(page.columns || SPL.rows.columns({ Row: page.rows }));
          }

          return page;
        },
      };

      let result;

      try {
        result = await SPL.crawl.run({
          api: readingApi,
          rootFolder: context.folderUrl,
          recursive,
          maxDepth: settings.maxCrawlDepth,
          maxFolders: settings.maxCrawlFolders,
          shouldStop,
          onPage(pageRows, state) {
            chunks.push(writer.chunk(pageRows));
            found = state.found;

            onProgress({ found, total, folder: recursive ? state.folder : undefined });
          },
        });
      } catch (error) {
        // Three minutes of crawling should not evaporate because the last page
        // failed; the panel offers to save what was read.
        error.partial = { chunks: finish(chunks, writer), found, format };

        throw error;
      }

      if (result.stopped) return { ...result, saved: false };

      save(SPL.download.fileName(context.listUrl, format), finish(chunks, writer), format);

      return { ...result, saved: true };
    },
  };

  function finish(chunks, writer) {
    return writer ? [...chunks, writer.footer()] : chunks;
  }

  // A list whose metadata cannot be read is still worth exporting; the run
  // simply has no denominator.
  async function listInfo(api) {
    try {
      return await api.listInfo();
    } catch {
      return { itemCount: undefined };
    }
  }
})((globalThis.SPL = globalThis.SPL || {}));
