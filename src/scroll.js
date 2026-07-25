'use strict';

// The original DOM-scrolling feature, extracted unchanged apart from
// configurable timings and honest terminal states. It exists alongside the API
// path because only scrolling makes the page itself hold every row, which is
// what SharePoint's own select-all and "Download as zip" operate on.
(function (SPL) {
  const rowSelector = [
    '[role="row"]',
    '[data-automationid="DetailsRow"]',
    '[data-automationid="FieldRenderer-name"]',
  ].join(',');

  function scrollableElements() {
    return [...document.querySelectorAll('body *')].filter((element) => {
      const style = getComputedStyle(element);

      return (
        /(auto|scroll)/.test(style.overflowY) &&
        element.clientHeight > 150 &&
        element.scrollHeight > element.clientHeight + 20
      );
    });
  }

  function likelyListScroller() {
    const candidates = scrollableElements();

    return (
      candidates.sort((left, right) => {
        const leftRows = left.querySelectorAll(
          '[role="row"], [data-automationid="DetailsRow"]'
        ).length;

        const rightRows = right.querySelectorAll(
          '[role="row"], [data-automationid="DetailsRow"]'
        ).length;

        return rightRows - leftRows || right.scrollHeight - left.scrollHeight;
      })[0] || document.scrollingElement
    );
  }

  SPL.scroll = {
    // Resolves to { itemCount, reason } where reason is 'complete', 'stopped',
    // 'timeout', or 'no-list'. A run that hits the time limit reports
    // 'timeout' rather than claiming success.
    async run({ settleMs, maxRunMs, onProgress, shouldStop }) {
      const scroller = likelyListScroller();

      if (!scroller) return { itemCount: 0, reason: 'no-list' };

      const startedAt = Date.now();

      let lastChange = Date.now();
      let previousHeight = 0;
      let previousItems = 0;
      let itemCount = 0;

      while (true) {
        if (shouldStop()) return { itemCount, reason: 'stopped' };

        if (Date.now() - startedAt >= maxRunMs) return { itemCount, reason: 'timeout' };

        itemCount = scroller.querySelectorAll(rowSelector).length;

        const height = scroller.scrollHeight;

        if (height !== previousHeight || itemCount !== previousItems) {
          previousHeight = height;
          previousItems = itemCount;
          lastChange = Date.now();
        }

        scroller.scrollTop = Math.min(
          scroller.scrollTop + Math.max(300, scroller.clientHeight * 0.8),
          height
        );

        onProgress(itemCount);

        const reachedBottom =
          scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;

        if (reachedBottom && Date.now() - lastChange >= settleMs) {
          return { itemCount, reason: 'complete' };
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
      }
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
