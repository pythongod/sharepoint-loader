'use strict';

// Parses CHANGELOG.md into the part meant for users. The split is structural:
// everything between a "## <version>" heading and the first following "###" is
// user-facing, so nothing has to be marked up per line and the two audiences
// cannot drift apart.
(function (SPL) {
  const VERSION_HEADING = /^##\s+([^\s—-]+)\s*(?:[—-]\s*(.+))?$/;

  SPL.changelog = {
    // [{ version, date, lines }] in file order. Input that does not match the
    // shape yields no entry rather than throwing: a malformed changelog must
    // not take the options page down with it.
    highlights(markdown) {
      if (typeof markdown !== 'string') return [];

      const entries = [];

      let current = null;
      let collecting = false;

      for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trim();
        const heading = VERSION_HEADING.exec(line);

        if (heading) {
          current = { version: heading[1], date: heading[2] ? heading[2].trim() : null, lines: [] };
          entries.push(current);
          collecting = true;

          continue;
        }

        // A detail heading ends the user-facing part until the next version.
        if (line.startsWith('###')) {
          collecting = false;

          continue;
        }

        if (!collecting || !current || line === '') continue;

        current.lines.push(line.replace(/^[-*]\s+/, ''));
      }

      return entries;
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
