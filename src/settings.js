'use strict';

// Settings defaults are pure and stored values are merged over them, so a
// missing, unknown, or corrupt key in chrome.storage can never break startup.
(function (SPL) {
  const defaults = Object.freeze({
    pageSize: 500,
    maxCrawlDepth: 10,
    maxCrawlFolders: 2000,
    csvDelimiter: ',',
    csvBom: true,
    datesInUtc: true,
    includeSubfoldersByDefault: false,
    scrollSettleMs: 2500,
    scrollMaxRunMs: 300000,
  });

  const clampInteger = (min, max) => (value) =>
    Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : null;

  const oneOf = (allowed) => (value) => (allowed.includes(value) ? value : null);

  const boolean = (value) => (typeof value === 'boolean' ? value : null);

  // SharePoint rejects a RowLimit above 5000 (the list view threshold).
  const rules = {
    pageSize: clampInteger(1, 5000),
    maxCrawlDepth: clampInteger(1, 1000),
    maxCrawlFolders: clampInteger(1, 100000),
    csvDelimiter: oneOf([',', ';']),
    csvBom: boolean,
    datesInUtc: boolean,
    includeSubfoldersByDefault: boolean,
    scrollSettleMs: clampInteger(250, 60000),
    scrollMaxRunMs: clampInteger(1000, 3600000),
  };

  SPL.settings = {
    defaults,

    merge(stored) {
      const merged = { ...defaults };

      for (const [key, rule] of Object.entries(rules)) {
        if (!stored || !(key in stored)) continue;

        const accepted = rule(stored[key]);

        if (accepted !== null) merged[key] = accepted;
      }

      return merged;
    },

    // chrome.storage.sync is absent in tests and in any non-extension context.
    async load() {
      if (!globalThis.chrome || !chrome.storage || !chrome.storage.sync) {
        return { ...defaults };
      }

      try {
        return SPL.settings.merge(await chrome.storage.sync.get(Object.keys(defaults)));
      } catch {
        return { ...defaults };
      }
    },

    async save(values) {
      await chrome.storage.sync.set(SPL.settings.merge(values));
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
