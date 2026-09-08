'use strict';

// The in-page control. Rendered into a shadow root so SharePoint's stylesheets
// cannot reach in and this panel's styles cannot leak out.
(function (SPL) {
  const HOST_ID = 'sharepoint-loader-panel';

  // Export CSV / JSON is built and tested, but hidden until Load full list is
  // the action we are willing to ship as the main one. Flip this to show the
  // export buttons, Include subfolders, and Save partial again.
  const SHOW_EXPORT = false;

  // Every match is counted, but only this many are drawn. A query of one
  // letter in a large folder matches thousands of names, and a shadow-root
  // list of thousands of anchors janks the page it is sitting on.
  const MAX_HITS = 50;

  // Colours live in custom properties so the dark palette is one override
  // rather than a second copy of the stylesheet. `all: initial` does not reset
  // custom properties, so the two rules below coexist.
  const STYLE = `
    :host { all: initial; }
    :host {
      color-scheme: light;
      --bg: #ffffff;
      --fg: #242424;
      --muted: #616161;
      --line: #ededed;
      --border: #d1d1d1;
      --hover: #f0f0f0;
      --accent: #0f6cbd;
      --accent-ink: #ffffff;
      --accent-text: #0f6cbd;
      --danger: #a4262c;
      --shadow: rgba(0,0,0,.2);
    }
    /* Follow the system unless the user has pinned a theme. */
    @media (prefers-color-scheme: dark) {
      :host(:not([data-theme="light"])) {
        color-scheme: dark;
        --bg: #292929;
        --fg: #f5f5f5;
        --muted: #adadad;
        --line: #3d3d3d;
        --border: #4a4a4a;
        --hover: #3d3d3d;
        --accent: #115ea3;
        --accent-ink: #ffffff;
        --accent-text: #479ef5;
        --danger: #f1707b;
        --shadow: rgba(0,0,0,.5);
      }
    }
    :host([data-theme="dark"]) {
      color-scheme: dark;
      --bg: #292929;
      --fg: #f5f5f5;
      --muted: #adadad;
      --line: #3d3d3d;
      --border: #4a4a4a;
      --hover: #3d3d3d;
      --accent: #115ea3;
      --accent-ink: #ffffff;
      --accent-text: #479ef5;
      --danger: #f1707b;
      --shadow: rgba(0,0,0,.5);
    }
    .panel {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      box-sizing: border-box; min-width: 280px; max-width: 380px;
      font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: var(--fg); background: var(--bg);
      border: 1px solid var(--border); border-radius: 6px;
      box-shadow: 0 4px 16px var(--shadow);
    }
    .pill {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      padding: 10px 16px; border: 1px solid var(--accent); border-radius: 4px;
      background: var(--accent); color: var(--accent-ink); cursor: pointer;
      font: 600 14px/20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 2px 8px var(--shadow);
    }
    header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid var(--line);
    }
    header h1 { flex: 1; margin: 0; font-size: 13px; font-weight: 600; }
    header button {
      padding: 2px 6px; border: 0; border-radius: 3px;
      background: transparent; color: var(--muted); cursor: pointer; font-size: 13px;
    }
    header button:hover { background: var(--hover); }
    /* .actions sets display, which outranks the user-agent [hidden] rule and
       would leave Stop and Save partial permanently on screen. */
    [hidden] { display: none !important; }
    .body { padding: 12px; display: grid; gap: 8px; }
    .subtitle { color: var(--muted); }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .actions button {
      flex: 1 1 auto; padding: 7px 12px; border-radius: 4px; cursor: pointer;
      border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink);
      font: 600 13px/1.2 inherit;
    }
    .actions button.secondary {
      background: transparent; color: var(--accent-text); border-color: var(--accent-text);
    }
    .actions button:disabled { opacity: .5; cursor: default; }
    label { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--fg); }
    .status { padding-top: 2px; color: var(--muted); }
    .status.error { color: var(--danger); }
    button:focus-visible, label:focus-within {
      outline: 2px solid var(--accent-text); outline-offset: 2px;
    }
    .query {
      box-sizing: border-box; width: 100%; padding: 6px 8px;
      border: 1px solid var(--border); border-radius: 4px;
      background: var(--bg); color: var(--fg); font: 400 13px/1.3 inherit;
    }
    .query::placeholder { color: var(--muted); }
    .query:focus-visible { outline: 2px solid var(--accent-text); outline-offset: 1px; }
    .note { color: var(--muted); }
    .note.error { color: var(--danger); }
    .hits {
      max-height: 220px; overflow-y: auto;
      border: 1px solid var(--line); border-radius: 4px;
    }
    .hit {
      display: flex; align-items: center; gap: 6px;
      padding: 5px 8px; border-bottom: 1px solid var(--line);
      color: var(--fg); text-decoration: none;
    }
    .hit:last-child { border-bottom: 0; }
    a.hit:hover { background: var(--hover); text-decoration: underline; }
    a.hit:focus-visible { outline: 2px solid var(--accent-text); outline-offset: -2px; }
    .hit .glyph { flex: 0 0 auto; }
    .hit .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;

  SPL.panel = {
    mount(context) {
      const existing = document.getElementById(HOST_ID);

      if (existing) existing.remove();

      const host = document.createElement('div');

      host.id = HOST_ID;

      const root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');

      style.textContent = STYLE;
      root.append(style);

      const view = render(root);
      const controller = createController(view, context, host);

      (document.body || document.documentElement).append(host);

      return {
        update(next) {
          controller.setContext(next);
        },
        destroy() {
          controller.stop();
          host.remove();
        },
      };
    },

    HOST_ID,
  };

  function render(root) {
    const pill = document.createElement('button');

    pill.className = 'pill';
    pill.textContent = 'SharePoint Loader';

    const panel = document.createElement('div');

    panel.className = 'panel';
    panel.hidden = true;
    panel.innerHTML = `
      <header>
        <h1>SharePoint Loader</h1>
        <button class="settings" title="Settings" aria-label="Settings">⚙</button>
        <button class="close" title="Hide" aria-label="Hide">✕</button>
      </header>
      <div class="body">
        <div class="subtitle"></div>
        <input class="query" type="search" autocomplete="off" spellcheck="false"
               placeholder="Find by name in this folder"
               aria-label="Find by name in this folder">
        <div class="note" role="status" aria-live="polite" hidden></div>
        <div class="hits" hidden></div>
        <div class="actions">
          <button class="load">Load full list</button>
        </div>
        <div class="actions export-row"${SHOW_EXPORT ? '' : ' hidden'}>
          <button class="csv secondary">Export CSV</button>
          <button class="json secondary">Export JSON</button>
        </div>
        <label class="recursive-row"${SHOW_EXPORT ? '' : ' hidden'}><input type="checkbox" class="recursive"> Include subfolders</label>
        <div class="actions stop-row" hidden><button class="stop">Stop</button></div>
        <div class="actions partial-row" hidden>
          <button class="partial secondary">Save partial</button>
        </div>
        <div class="status" role="status" aria-live="polite">Idle</div>
      </div>
    `;

    root.append(pill, panel);

    // Reading the version from the manifest keeps it correct without anyone
    // remembering to update a string here on release.
    // getManifest throws "Extension context invalidated" in a content script
    // orphaned by an extension reload, and this runs while the panel is being
    // built — a throw here would cost the whole panel, not just its version.
    let manifest = null;

    try {
      if (globalThis.chrome && chrome.runtime && chrome.runtime.getManifest) {
        manifest = chrome.runtime.getManifest();
      }
    } catch {
      manifest = null;
    }

    if (manifest) {
      const tag = panel.querySelector('h1');

      tag.textContent = `${manifest.name} ${manifest.version}`;
      tag.title = `Version ${manifest.version}`;
    }

    const find = (selector) => panel.querySelector(selector);

    return {
      pill,
      panel,
      subtitle: find('.subtitle'),
      status: find('.status'),
      query: find('.query'),
      note: find('.note'),
      hits: find('.hits'),
      load: find('.load'),
      csv: find('.csv'),
      json: find('.json'),
      recursive: find('.recursive'),
      stopRow: find('.stop-row'),
      stop: find('.stop'),
      partialRow: find('.partial-row'),
      partial: find('.partial'),
      settings: find('.settings'),
      close: find('.close'),
    };
  }

  function createController(view, initialContext, host) {
    let context = initialContext;
    let settings = SPL.settings.defaults;
    let running = false;
    let cancelled = false;
    let partial = null;
    // The search index: null until the folder has been read, then one entry
    // per item. Discarded whenever the panel moves to another folder or view,
    // because both change what the list would show.
    let entries = null;
    let indexing = null;
    let indexError = null;
    let indexTruncated = false;
    // An index for the folder we have since left must not land in `entries`.
    let indexToken = 0;
    let isLibrary;

    const shouldStop = () => cancelled;

    const setStatus = (text, isError) => {
      view.status.textContent = text;
      view.status.classList.toggle('error', Boolean(isError));
    };

    // The search has its own line: a scroll and a search can be in flight at
    // once, and neither should overwrite what the other is reporting.
    const setNote = (text, isError) => {
      view.note.textContent = text || '';
      view.note.hidden = !text;
      view.note.classList.toggle('error', Boolean(isError));
    };

    const setRunning = (state) => {
      running = state;
      view.stopRow.hidden = !state;

      const actions = SHOW_EXPORT ? [view.load, view.csv, view.json] : [view.load];

      for (const button of actions) button.disabled = state;

      if (state) view.partialRow.hidden = true;
    };

    const offerPartial = (found, chunks, format) => {
      partial = { chunks, format };
      view.partial.textContent = `Save partial (${found})`;
      view.partialRow.hidden = false;
    };

    // 'auto' leaves the attribute off, which lets the prefers-color-scheme
    // rule decide; a pinned theme sets it and wins.
    const applyTheme = (theme) => {
      if (theme === 'auto') host.removeAttribute('data-theme');
      else host.setAttribute('data-theme', theme);
    };

    SPL.settings.load().then((loaded) => {
      settings = loaded;
      if (SHOW_EXPORT) view.recursive.checked = loaded.includeSubfoldersByDefault;
      applyTheme(loaded.theme);
    });

    // Reflect a theme change made on the options page without a reload.
    if (globalThis.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.theme) applyTheme(changes.theme.newValue);
      });
    }

    view.pill.addEventListener('click', () => {
      view.pill.hidden = true;
      view.panel.hidden = false;
      describe();
    });

    view.close.addEventListener('click', () => {
      view.panel.hidden = true;
      view.pill.hidden = false;
    });

    view.settings.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'open-options' });
    });

    view.stop.addEventListener('click', () => {
      cancelled = true;
      setStatus('Stopping…');
    });

    view.load.addEventListener('click', () => runScroll());

    view.query.addEventListener('input', () => runQuery());

    view.query.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        view.query.value = '';
        clearHits();

        return;
      }

      // Enter opens the top hit, which is the habit Ctrl+F built.
      if (event.key !== 'Enter') return;

      const first = view.hits.querySelector('a.hit');

      if (!first) return;

      event.preventDefault();
      first.click();
    });

    if (SHOW_EXPORT) {
      view.partial.addEventListener('click', () => {
        SPL.download.save(
          SPL.download.fileName(context.listUrl, partial.format),
          partial.chunks,
          partial.format
        );
        view.partialRow.hidden = true;
      });
      view.csv.addEventListener('click', () => runExport('csv'));
      view.json.addEventListener('click', () => runExport('json'));
    }

    async function describe() {
      const leaf = context.listUrl.split('/').filter(Boolean).pop();

      view.subtitle.textContent = leaf;

      try {
        const info = await client().listInfo();

        // Kept so a search does not have to ask again: whether this is a
        // library or a generic list decides the shape of a result's link.
        isLibrary = info.isLibrary;
        view.subtitle.textContent = `${leaf} · ${info.itemCount.toLocaleString()} items`;
      } catch {
        // A missing count costs nothing here; Load full list still runs.
      }
    }

    function client() {
      return SPL.api.create({
        fetch: (url, init) => globalThis.fetch(url, init),
        origin: context.origin,
        webUrl: context.webUrl,
        listUrl: context.listUrl,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      });
    }

    function clearHits() {
      view.hits.textContent = '';
      view.hits.hidden = true;
      setNote('');
      // Clearing the field is the retry gesture for a read that failed for a
      // reason that has since passed, such as a dropped connection.
      indexError = null;
    }

    // Reads the folder once and keeps it. Concurrent keystrokes share the one
    // in-flight read rather than starting a request each.
    function readFolder() {
      if (entries) return Promise.resolve(entries);
      if (indexing) return indexing;

      const token = indexToken;

      setNote('Reading this folder…');

      indexing = SPL.search
        .index({
          api: client(),
          context,
          pageHref: location.href,
          settings,
          isLibrary,
          // Moving to another folder abandons the read for the old one
          // instead of paging to the end of a list nobody is looking at.
          shouldStop: () => token !== indexToken,
          onProgress: ({ found }) =>
            setNote(`Reading this folder · ${SPL.progress.label({ found })}`),
        })
        .then((result) => {
          if (token !== indexToken) return null;

          entries = result.entries;
          indexTruncated = result.truncated;

          return entries;
        })
        .catch((error) => {
          if (token !== indexToken) return null;

          // Held so that typing another letter does not retry a request that
          // failed for a reason the next keystroke cannot change.
          indexError = error.message;
          setNote(indexError, true);

          return null;
        })
        .finally(() => {
          indexing = null;
        });

      return indexing;
    }

    async function runQuery() {
      const query = view.query.value.trim();

      if (!query) {
        clearHits();

        return;
      }

      if (indexError) {
        setNote(indexError, true);

        return;
      }

      const found = entries || (await readFolder());

      // A later keystroke, or a move to another folder, has superseded this.
      if (!found || view.query.value.trim() !== query) return;

      showHits(SPL.search.matches(found, query, { limit: MAX_HITS }));
    }

    function showHits({ hits, total }) {
      view.hits.textContent = '';

      for (const hit of hits) view.hits.append(hitRow(hit));

      view.hits.hidden = hits.length === 0;
      setNote(hitNote(hits.length, total));
    }

    function hitRow(hit) {
      // An item we cannot link to is still worth showing: knowing the name is
      // there answers the question that was asked.
      const row = document.createElement(hit.url ? 'a' : 'div');

      row.className = 'hit';

      if (hit.url) row.href = hit.url;

      const glyph = document.createElement('span');

      glyph.className = 'glyph';
      glyph.textContent = hit.isFolder ? '📁' : '📄';
      glyph.setAttribute('aria-hidden', 'true');

      const name = document.createElement('span');

      name.className = 'name';
      // Long names are clipped to keep the panel narrow; the full name stays
      // available on hover.
      name.textContent = hit.name;
      name.title = hit.name;

      row.append(glyph, name);

      return row;
    }

    function hitNote(shown, total) {
      // The ceiling is worth naming only when it could be hiding the answer.
      const read = indexTruncated
        ? ` · first ${SPL.search.MAX_ENTRIES.toLocaleString()} items read`
        : '';

      if (total === 0) return indexTruncated ? `No match${read}` : 'No match in this folder';
      if (shown < total) return `${shown} of ${total.toLocaleString()} matches shown${read}`;

      return `${total} ${total === 1 ? 'match' : 'matches'}${read}`;
    }

    async function runScroll() {
      cancelled = false;
      setRunning(true);

      const result = await SPL.scroll.run({
        settleMs: settings.scrollSettleMs,
        maxRunMs: settings.scrollMaxRunMs,
        shouldStop,
        onProgress: (count) => setStatus(SPL.progress.label({ rendered: count })),
      });

      setRunning(false);
      setStatus(scrollMessage(result), result.reason === 'no-list');
    }

    async function runExport(format) {
      cancelled = false;
      partial = null;
      setRunning(true);
      setStatus(SPL.progress.label({ found: 0 }));

      try {
        const result = await SPL.exporter.run({
          api: client(),
          context,
          settings,
          format,
          recursive: view.recursive.checked,
          shouldStop,
          save: SPL.download.save,
          onProgress: (state) => setStatus(SPL.progress.label(state)),
        });

        setStatus(
          result.stopped
            ? SPL.progress.label({ found: result.found, stopped: true })
            : `${SPL.progress.label({ found: result.found, done: true })}${
                result.truncated ? ' · crawl limit reached' : ''
              }`
        );
      } catch (error) {
        setStatus(error.message, true);

        if (error.partial && error.partial.found > 0) {
          offerPartial(error.partial.found, error.partial.chunks, error.partial.format);
        }
      } finally {
        setRunning(false);
      }
    }

    return {
      setContext(next) {
        // SharePoint changes folder and view by rewriting the query string, so
        // the panel survives a move that invalidates everything it has read.
        const previous = context;

        context = next;

        const moved =
          previous.listUrl !== next.listUrl ||
          previous.folderUrl !== next.folderUrl ||
          previous.viewId !== next.viewId;

        if (moved) {
          indexToken += 1;
          entries = null;
          indexing = null;
          indexError = null;
          indexTruncated = false;

          if (previous.listUrl !== next.listUrl) isLibrary = undefined;

          clearHits();

          if (view.query.value.trim()) runQuery();
        }

        if (!running && !view.panel.hidden) describe();
      },
      stop() {
        cancelled = true;
      },
    };
  }

  function scrollMessage(result) {
    // The row count is what SharePoint has rendered, not what it has fetched:
    // its virtualised list keeps only a window in the page. Reporting the
    // window as a result made a run that fetched 305 items read as 72. On
    // success, point at the header checkbox instead — that is what acts on
    // everything the scroll pulled in.
    if (result.reason === 'no-list') return 'No scrollable list found on this page.';
    if (result.reason === 'stopped') {
      return SPL.progress.label({ rendered: result.itemCount, stopped: true });
    }
    if (result.reason === 'timeout') {
      return `Stopped at time limit · ${SPL.progress.label({ rendered: result.itemCount })}`;
    }

    return 'Fully scrolled — the whole list is loaded. Use the list’s header checkbox to select it all.';
  }
})((globalThis.SPL = globalThis.SPL || {}));
