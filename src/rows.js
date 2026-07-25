'use strict';

// Pure translation of RenderListDataAsStream payloads into rows, columns, and
// continuation tokens. Nothing here touches the network or the DOM.
(function (SPL) {
  SPL.rows = {
    // Where crawl.js records the folder a row came from, and where the
    // serializers read it back from.
    FOLDER_KEY: '__folder',

    // { rows, nextPaging } — nextPaging is the value to send back as the
    // Paging parameter, or null when the listing is complete.
    fromResponse(response) {
      const payload = response || {};

      return {
        rows: Array.isArray(payload.Row) ? payload.Row : [],
        nextPaging: payload.NextHref ? String(payload.NextHref).replace(/^\?/, '') : null,
      };
    },

    // Fallback continuation for tenants where NextHref is absent: page by the
    // last item ID seen. See the paging spike note in the design document.
    pagingFromLastRow(pageRows, idField) {
      if (!pageRows || pageRows.length === 0) return null;

      const field = idField || 'ID';
      const last = pageRows[pageRows.length - 1][field];

      return last === undefined || last === null ? null : `Paged=TRUE&p_${field}=${last}`;
    },

    // The view's visible columns, from the schema when available and from the
    // rows themselves otherwise.
    columns(response) {
      const payload = response || {};
      const fields = payload.ListSchema && payload.ListSchema.Field;

      if (Array.isArray(fields) && fields.length > 0) {
        return fields
          .filter((field) => String(field.Hidden).toUpperCase() !== 'TRUE')
          .map((field) => ({ name: field.Name, title: field.DisplayName || field.Name }));
      }

      const names = [];

      for (const row of Array.isArray(payload.Row) ? payload.Row : []) {
        for (const name of Object.keys(row)) {
          if (!name.startsWith('.') && !names.includes(name)) names.push(name);
        }
      }

      return names.map((name) => ({ name, title: name }));
    },

    isFolder(row) {
      return String((row || {}).FSObjType) === '1';
    },

    // SharePoint returns most values pre-formatted, but lookups, people, and
    // managed metadata arrive as objects or arrays of objects.
    value(row, name) {
      return text((row || {})[name]);
    },
  };

  function text(value) {
    if (value === null || value === undefined) return '';

    if (Array.isArray(value)) return value.map(text).filter(Boolean).join('; ');

    if (typeof value === 'object') {
      const display = value.lookupValue || value.title || value.Label || value.Title;

      return display === undefined || display === null ? '' : String(display);
    }

    return String(value);
  }
})((globalThis.SPL = globalThis.SPL || {}));
