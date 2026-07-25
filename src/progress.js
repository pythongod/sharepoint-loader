'use strict';

// Progress wording. A determinate total exists only for a whole-list read; a
// folder crawl reports what it has found and where it is, and never invents a
// percentage against a total it cannot know.
(function (SPL) {
  SPL.progress = {
    label(state) {
      const { found, total, folder, done, stopped, retryInSeconds } = state || {};

      if (found === undefined || found === null) return 'Idle';

      const count = number(found);

      if (done) return `Done · ${count} ${found === 1 ? 'item' : 'items'}`;
      if (stopped) return `Stopped · ${count} found`;
      if (retryInSeconds) return `Throttled — retrying in ${retryInSeconds} s · ${count} found`;

      // Crawling: the total covers the whole list, not the subtree being read,
      // so it would be a lie here.
      if (folder) return `${count} found · scanning ${shorten(folder)}`;

      if (total) return `${count} of ${number(total)}`;

      return `${count} found`;
    },
  };

  function number(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // Server-relative folder URLs are long and mostly site boilerplate; the last
  // couple of segments are what tells the user where the crawl has reached.
  function shorten(folder) {
    return folder.split('/').filter(Boolean).slice(-2).join('/');
  }
})((globalThis.SPL = globalThis.SPL || {}));
