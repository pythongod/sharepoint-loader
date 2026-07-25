'use strict';

// Streaming serializers. Each page of rows is converted to text and released
// immediately, so a large library holds formatted strings rather than a few
// hundred thousand row objects.
(function (SPL) {
  const BOM = '﻿';

  // Excel and Sheets evaluate cells beginning with these characters. Exported
  // SharePoint text must never execute.
  const formulaStart = /^[=+\-@]/;

  SPL.serialize = {
    csv(options) {
      const { columns, delimiter = ',', bom = false, pathColumn = null } = options;
      const escape = csvEscaper(delimiter);

      return {
        header() {
          const titles = columns.map((column) => column.title);

          if (pathColumn) titles.unshift(pathColumn);

          return (bom ? BOM : '') + titles.map(escape).join(delimiter) + '\r\n';
        },

        chunk(pageRows) {
          let out = '';

          for (const row of pageRows) {
            const cells = columns.map((column) => SPL.rows.value(row, column.name));

            if (pathColumn) cells.unshift(row[SPL.rows.FOLDER_KEY] || '');

            out += cells.map(escape).join(delimiter) + '\r\n';
          }

          return out;
        },

        footer() {
          return '';
        },
      };
    },

    json(options) {
      const { columns, pathColumn = null } = options;
      let written = 0;

      return {
        header() {
          return '[';
        },

        chunk(pageRows) {
          let out = '';

          for (const row of pageRows) {
            const record = {};

            if (pathColumn) record[pathColumn] = row[SPL.rows.FOLDER_KEY] || '';

            for (const column of columns) {
              record[column.title] = SPL.rows.value(row, column.name);
            }

            out += `${written === 0 ? '' : ','}\n${JSON.stringify(record)}`;
            written += 1;
          }

          return out;
        },

        footer() {
          return '\n]\n';
        },
      };
    },
  };

  function csvEscaper(delimiter) {
    return (value) => {
      const cell = formulaStart.test(value) ? `'${value}` : String(value);

      return cell.includes(delimiter) || /["\r\n]/.test(cell)
        ? `"${cell.replace(/"/g, '""')}"`
        : cell;
    };
  }
})((globalThis.SPL = globalThis.SPL || {}));
