'use strict';

// Content scripts cannot call chrome.runtime.openOptionsPage themselves, so
// the panel's settings button routes through here.
chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'open-options') chrome.runtime.openOptionsPage();
});

// The toolbar tooltip carries the version, so which build is installed can be
// read without opening chrome://extensions. Set at runtime from the manifest
// rather than written into default_title, which would need updating by hand on
// every release and would eventually disagree with the actual version.
function showVersion() {
  chrome.action.setTitle({
    title: `SharePoint Loader ${chrome.runtime.getManifest().version}`,
  });
}

chrome.runtime.onInstalled.addListener(showVersion);
chrome.runtime.onStartup.addListener(showVersion);

// The extension has no popup, so a click on the toolbar icon opens the
// settings — the one place it has to show.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
