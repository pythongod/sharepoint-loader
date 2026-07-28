'use strict';

// Binds the options form to SPL.settings. Field ids match setting names, so
// the mapping is derived from the defaults rather than repeated here.
(function (SPL) {
  const keys = Object.keys(SPL.settings.defaults);
  const field = (key) => document.getElementById(key);

  // 'auto' leaves the attribute off so the prefers-color-scheme rule decides.
  function applyTheme(theme) {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }

  function show(values) {
    for (const key of keys) {
      const input = field(key);

      if (!input) continue;

      if (input.type === 'checkbox') input.checked = values[key];
      else input.value = values[key];
    }

    applyTheme(values.theme);
  }

  function read() {
    const values = {};

    for (const key of keys) {
      const input = field(key);

      if (!input) continue;

      if (input.type === 'checkbox') values[key] = input.checked;
      else if (input.type === 'number') values[key] = Number(input.value);
      else values[key] = input.value;
    }

    return values;
  }

  function announce(text) {
    const saved = document.getElementById('saved');

    saved.textContent = text;
    setTimeout(() => {
      saved.textContent = '';
    }, 2000);
  }

  // Preview the theme as it is chosen; saving is what makes it stick.
  field('theme').addEventListener('change', (event) => applyTheme(event.target.value));

  document.getElementById('save').addEventListener('click', async () => {
    // merge clamps and rejects bad values, so redisplay what was actually kept.
    const accepted = SPL.settings.merge(read());

    await SPL.settings.save(accepted);
    show(accepted);
    announce('Saved');
  });

  document.getElementById('reset').addEventListener('click', async () => {
    await SPL.settings.save(SPL.settings.defaults);
    show(SPL.settings.defaults);
    announce('Defaults restored');
  });

  const manifest =
    globalThis.chrome && chrome.runtime && chrome.runtime.getManifest
      ? chrome.runtime.getManifest()
      : null;

  // Read from the manifest so the displayed version cannot drift from the
  // installed one.
  if (manifest) document.getElementById('version').textContent = manifest.version;

  // Five versions answer "what changed lately"; the rest stays in the
  // repository, along with every entry's technical detail.
  function renderChangelog(entries) {
    const container = document.getElementById('changelog');

    container.textContent = '';
    container.classList.toggle('empty', entries.length === 0);

    if (entries.length === 0) {
      container.textContent = 'No changelog available.';

      return;
    }

    for (const entry of entries.slice(0, 5)) {
      const heading = document.createElement('h3');

      heading.textContent = entry.version;

      if (entry.date) {
        const date = document.createElement('span');

        date.className = 'date';
        date.textContent = ` \u2014 ${entry.date}`;
        heading.append(date);
      }

      // Naming the running build closes the loop with the version in the
      // page heading: which one am I on, and what did it change.
      if (manifest && entry.version === manifest.version) {
        const badge = document.createElement('span');

        badge.className = 'installed';
        badge.textContent = 'installed';
        heading.append(badge);
      }

      container.append(heading);

      if (entry.lines.length === 0) continue;

      const list = document.createElement('ul');

      for (const line of entry.lines) {
        const item = document.createElement('li');

        item.textContent = line;
        list.append(item);
      }

      container.append(list);
    }
  }

  // The settings are this page's job; a changelog that cannot be read must
  // not stop them working.
  async function loadChangelog() {
    if (!globalThis.chrome || !chrome.runtime || !chrome.runtime.getURL) return;

    try {
      const response = await fetch(chrome.runtime.getURL('CHANGELOG.md'));

      if (!response.ok) throw new Error(String(response.status));

      renderChangelog(SPL.changelog.highlights(await response.text()));
    } catch {
      renderChangelog([]);
    }
  }

  loadChangelog();

  SPL.settings.load().then(show);
})(globalThis.SPL);
