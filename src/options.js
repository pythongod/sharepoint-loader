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

  SPL.settings.load().then(show);
})(globalThis.SPL);
