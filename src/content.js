'use strict';

// Entry point. Mounts the panel only where a list actually exists, and follows
// SharePoint's in-page navigation, which changes folders by rewriting the
// query string without ever reloading the document.
(function (SPL) {
  const POLL_MS = 250;

  let mounted = null;
  let lastHref = null;

  function sync() {
    if (location.href === lastHref) return;

    lastHref = location.href;

    const context = SPL.url.parse(location.href);

    if (!context) {
      if (mounted) {
        mounted.destroy();
        mounted = null;
      }

      return;
    }

    // Moving between folders of the same list keeps the panel and its state;
    // moving to a different list rebuilds it.
    if (mounted && mounted.context.listUrl === context.listUrl) {
      mounted.context = context;
      mounted.update(context);

      return;
    }

    if (mounted) mounted.destroy();

    mounted = SPL.panel.mount(context);
    mounted.context = context;
  }

  function start() {
    sync();
    setInterval(sync, POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})((globalThis.SPL = globalThis.SPL || {}));
