'use strict';

// Content scripts cannot call chrome.runtime.openOptionsPage themselves, so
// the panel's settings button routes through here. This is the whole worker.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'open-options') chrome.runtime.openOptionsPage();
});
