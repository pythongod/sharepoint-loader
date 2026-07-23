(function startSharePointLoader() {
  const buttonId = "sharepoint-loader-load-all";
  const settleTime = 2500;
  const maximumRunTime = 5 * 60 * 1000;

  function scrollableElements() {
    return [...document.querySelectorAll("body *")].filter((element) => {
      const style = getComputedStyle(element);
      return /(auto|scroll)/.test(style.overflowY) &&
        element.clientHeight > 150 &&
        element.scrollHeight > element.clientHeight + 20;
    });
  }

  function likelyListScroller() {
    const candidates = scrollableElements();

    return candidates.sort((left, right) => {
      const leftRows = left.querySelectorAll(
        '[role="row"], [data-automationid="DetailsRow"]'
      ).length;

      const rightRows = right.querySelectorAll(
        '[role="row"], [data-automationid="DetailsRow"]'
      ).length;

      return (rightRows - leftRows) ||
        (right.scrollHeight - left.scrollHeight);
    })[0] || document.scrollingElement;
  }

  function start() {
    const button = document.createElement("button");

    button.id = buttonId;
    button.type = "button";
    button.textContent = "Load full list";
    button.title =
      "Scroll through the SharePoint list so dynamically loaded folders become available";

    button.style.cssText = [
      "all: initial",
      "position: fixed",
      "right: 20px",
      "bottom: 20px",
      "z-index: 2147483647",
      "box-sizing: border-box",
      "padding: 10px 16px",
      "border: 1px solid #0f6cbd",
      "border-radius: 4px",
      "background: #0f6cbd",
      "color: white",
      "font: 600 14px/20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "cursor: pointer",
      "box-shadow: 0 2px 8px rgba(0,0,0,.25)"
    ].join(";");

    let cancelled = false;
    let running = false;

    const setIdle = (label = "Load full list") => {
      running = false;
      button.disabled = false;
      button.textContent = label;

      setTimeout(() => {
        if (!running && button.isConnected) {
          button.textContent = "Load full list";
        }
      }, 3000);
    };

    const loadAll = async () => {
      if (running) {
        cancelled = true;
        button.textContent = "Stopping…";
        return;
      }

      const scroller = likelyListScroller();

      if (!scroller) {
        setIdle("List not found");
        return;
      }

      running = true;
      cancelled = false;

      const startedAt = Date.now();
      let lastChange = Date.now();
      let previousHeight = 0;
      let previousItems = 0;

      while (
        !cancelled &&
        Date.now() - startedAt < maximumRunTime
      ) {
        const itemCount = scroller.querySelectorAll(
          [
            '[role="row"]',
            '[data-automationid="DetailsRow"]',
            '[data-automationid="FieldRenderer-name"]'
          ].join(",")
        ).length;

        const height = scroller.scrollHeight;

        if (
          height !== previousHeight ||
          itemCount !== previousItems
        ) {
          previousHeight = height;
          previousItems = itemCount;
          lastChange = Date.now();
        }

        scroller.scrollTop = Math.min(
          scroller.scrollTop +
            Math.max(300, scroller.clientHeight * 0.8),
          height
        );

        button.textContent =
          `Loading… ${itemCount || ""}`.trim();

        const reachedBottom =
          scroller.scrollTop + scroller.clientHeight >=
          scroller.scrollHeight - 2;

        if (
          reachedBottom &&
          Date.now() - lastChange >= settleTime
        ) {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
      }

      setIdle(cancelled ? "Stopped" : "List loaded");
    };

    button.addEventListener("click", loadAll);
    (document.body || document.documentElement).append(button);
  }

  start();
})();
