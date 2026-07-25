'use strict';

// The in-page control. Rendered into a shadow root so SharePoint's stylesheets
// cannot reach in and this panel's styles cannot leak out.
(function (SPL) {
  const HOST_ID = 'sharepoint-loader-panel';

  const STYLE = `
    :host { all: initial; }
    .panel {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      box-sizing: border-box; min-width: 260px;
      font: 400 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #242424; background: #fff;
      border: 1px solid #d1d1d1; border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
    }
    .pill {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
      padding: 10px 16px; border: 1px solid #0f6cbd; border-radius: 4px;
      background: #0f6cbd; color: #fff; cursor: pointer;
      font: 600 14px/20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,.25);
    }
    header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-bottom: 1px solid #ededed;
    }
    header h1 { flex: 1; margin: 0; font-size: 13px; font-weight: 600; }
    header button {
      padding: 2px 6px; border: 0; border-radius: 3px;
      background: transparent; color: #616161; cursor: pointer; font-size: 13px;
    }
    header button:hover { background: #f0f0f0; }
    .body { padding: 12px; display: grid; gap: 8px; }
    .subtitle { color: #616161; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .actions button {
      flex: 1 1 auto; padding: 7px 12px; border-radius: 4px; cursor: pointer;
      border: 1px solid #0f6cbd; background: #0f6cbd; color: #fff;
      font: 600 13px/1.2 inherit;
    }
    .actions button.secondary { background: #fff; color: #0f6cbd; }
    .actions button:disabled { opacity: .5; cursor: default; }
    label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .status { padding-top: 2px; color: #616161; }
    .status.error { color: #a4262c; }
    button:focus-visible, label:focus-within { outline: 2px solid #0f6cbd; outline-offset: 2px; }
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
      const controller = createController(view, context);

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
        <div class="actions">
          <button class="load">Load full list</button>
        </div>
        <div class="actions">
          <button class="csv secondary">Export CSV</button>
          <button class="json secondary">Export JSON</button>
        </div>
        <label><input type="checkbox" class="recursive"> Include subfolders</label>
        <div class="actions stop-row" hidden><button class="stop">Stop</button></div>
        <div class="actions partial-row" hidden>
          <button class="partial secondary">Save partial</button>
        </div>
        <div class="status" role="status" aria-live="polite">Idle</div>
      </div>
    `;

    root.append(pill, panel);

    const find = (selector) => panel.querySelector(selector);

    return {
      pill,
      panel,
      subtitle: find('.subtitle'),
      status: find('.status'),
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

  function createController(view, initialContext) {
    let context = initialContext;
    let settings = SPL.settings.defaults;
    let running = false;
    let cancelled = false;
    let partial = null;

    const shouldStop = () => cancelled;

    const setStatus = (text, isError) => {
      view.status.textContent = text;
      view.status.classList.toggle('error', Boolean(isError));
    };

    const setRunning = (state) => {
      running = state;
      view.stopRow.hidden = !state;

      for (const button of [view.load, view.csv, view.json]) button.disabled = state;

      if (state) view.partialRow.hidden = true;
    };

    const offerPartial = (found, chunks, format) => {
      partial = { chunks, format };
      view.partial.textContent = `Save partial (${found})`;
      view.partialRow.hidden = false;
    };

    SPL.settings.load().then((loaded) => {
      settings = loaded;
      view.recursive.checked = loaded.includeSubfoldersByDefault;
    });

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

    view.partial.addEventListener('click', () => {
      SPL.download.save(
        SPL.download.fileName(context.listUrl, partial.format),
        partial.chunks,
        partial.format
      );
      view.partialRow.hidden = true;
    });

    view.load.addEventListener('click', () => runScroll());
    view.csv.addEventListener('click', () => runExport('csv'));
    view.json.addEventListener('click', () => runExport('json'));

    async function describe() {
      const leaf = context.listUrl.split('/').filter(Boolean).pop();

      view.subtitle.textContent = leaf;

      try {
        const info = await client().listInfo();

        view.subtitle.textContent = `${leaf} · ${info.itemCount.toLocaleString()} items`;
      } catch {
        // A missing count costs nothing here; the export still runs.
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

    async function runScroll() {
      cancelled = false;
      setRunning(true);

      const result = await SPL.scroll.run({
        settleMs: settings.scrollSettleMs,
        maxRunMs: settings.scrollMaxRunMs,
        shouldStop,
        onProgress: (count) => setStatus(SPL.progress.label({ found: count })),
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
        context = next;

        if (!running && !view.panel.hidden) describe();
      },
      stop() {
        cancelled = true;
      },
    };
  }

  function scrollMessage(result) {
    if (result.reason === 'no-list') return 'No scrollable list found on this page.';
    if (result.reason === 'stopped') return `Stopped · ${result.itemCount} rows loaded`;
    if (result.reason === 'timeout') {
      return `Stopped at time limit · ${result.itemCount} rows loaded`;
    }

    return `Loaded · ${result.itemCount} rows in the page`;
  }
})((globalThis.SPL = globalThis.SPL || {}));
