'use strict';

// Parses CHANGELOG.md into the part meant for users. The split is structural:
// everything between a "## <version>" heading and the first following "###" is
// user-facing, so nothing has to be marked up per line and the two audiences
// cannot drift apart.
(function (SPL) {
  const VERSION_HEADING = /^##\s+(\S+)(?:\s+[—–-]\s+(.+?))?\s*$/;

  SPL.changelog = {
    // [{ version, date, lines }] in file order. Input that does not match the
    // shape yields no entry rather than throwing: a malformed changelog must
    // not take the options page down with it.
    highlights(markdown) {
      if (typeof markdown !== 'string') return [];

      const entries = [];

      let current = null;
      let collecting = false;
      // Set while a paragraph or bullet is still being built, so the next
      // source line can be appended to it rather than starting a new one.
      let open = false;

      // Prose in the file is hard-wrapped, so a single sentence spans several
      // source lines. Joining them keeps one thought as one item instead of
      // rendering each wrapped line as its own bullet.
      const append = (text, startsItem) => {
        if (startsItem || !open) current.lines.push(text);
        else current.lines[current.lines.length - 1] += ` ${text}`;

        open = true;
      };

      for (const raw of markdown.split(/\r?\n/)) {
        const line = raw.trim();
        const heading = VERSION_HEADING.exec(line);

        if (heading) {
          current = { version: heading[1], date: heading[2] ? heading[2].trim() : null, lines: [] };
          entries.push(current);
          collecting = true;
          open = false;

          continue;
        }

        // A detail heading ends the user-facing part until the next version.
        if (line.startsWith('###')) {
          collecting = false;
          open = false;

          continue;
        }

        if (!collecting || !current) continue;

        // A blank line closes whatever was being built.
        if (line === '') {
          open = false;

          continue;
        }

        const bullet = /^[-*]\s+/.test(line);

        append(line.replace(/^[-*]\s+/, ''), bullet);
      }

      return entries;
    },
  };
})((globalThis.SPL = globalThis.SPL || {}));
