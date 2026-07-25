'use strict';

// settings.js reaches for chrome.storage, which does not exist under node.
// Loading it through this helper keeps that detail out of the test files.
require('../src/settings.js');

module.exports = globalThis.SPL;
