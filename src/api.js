'use strict';

// The only module that talks to SharePoint. fetch and sleep are injected so
// the retry and throttling behaviour can be driven directly in tests.
//
// Requests target the same origin as the page the content script runs in, so
// they are ordinary same-origin requests carrying the user's session cookie —
// no service worker proxy and no extra host permissions are involved.
(function (SPL) {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [1000, 4000];

  class ApiError extends Error {
    constructor(kind, message) {
      super(message);
      this.name = 'ApiError';
      this.kind = kind;
    }
  }

  SPL.api = {
    ApiError,

    create({ fetch, origin, webUrl, listUrl, sleep }) {
      const web = `${origin}${webUrl === '/' ? '' : webUrl}`;
      const listParam = `?@listUrl='${encodeURIComponent(listUrl)}'`;

      let digest = null;
      let digestExpiresAt = 0;

      async function formDigest() {
        if (digest && Date.now() < digestExpiresAt) return digest;

        const response = await send(`${web}/_api/contextinfo`, {
          method: 'POST',
          headers: { Accept: 'application/json;odata=nometadata' },
          credentials: 'same-origin',
        });
        const body = await response.json();

        digest = body.FormDigestValue;
        // Renew a minute early rather than racing the expiry.
        digestExpiresAt = Date.now() + ((body.FormDigestTimeoutSeconds || 1800) - 60) * 1000;

        return digest;
      }

      // One request, with retry for throttling and transient network failure.
      async function send(url, init) {
        let lastNetworkError = null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          let response;

          try {
            response = await fetch(url, init);
          } catch (error) {
            lastNetworkError = error;

            if (attempt < MAX_ATTEMPTS - 1) await sleep(BACKOFF_MS[attempt]);

            continue;
          }

          if (response.ok) return response;

          if (response.status === 429 || response.status === 503) {
            if (attempt === MAX_ATTEMPTS - 1) break;

            await sleep(retryDelay(response, attempt));

            continue;
          }

          throw await failure(response);
        }

        throw new ApiError(
          'network',
          lastNetworkError ? lastNetworkError.message : 'SharePoint is not responding.'
        );
      }

      return {
        async listInfo() {
          const response = await send(
            `${web}/_api/web/GetList(@listUrl)${listParam}&$select=Id,ItemCount,BaseType`,
            {
              method: 'GET',
              headers: { Accept: 'application/json;odata=nometadata' },
              credentials: 'same-origin',
            }
          );
          const body = await response.json();

          return {
            id: body.Id,
            itemCount: body.ItemCount,
            // BaseType 1 is a document library; 0 is a generic list.
            isLibrary: body.BaseType === 1,
          };
        },

        async listPage({ viewId, folderUrl, paging, pageSize, datesInUtc, withSchema }) {
          const parameters = {};

          if (viewId) parameters.ViewId = viewId;
          if (datesInUtc !== undefined) parameters.DatesInUtc = datesInUtc;
          if (pageSize) parameters.RowLimit = pageSize;
          if (folderUrl) parameters.FolderServerRelativeUrl = folderUrl;
          if (paging) parameters.Paging = paging;
          if (withSchema) parameters.RenderOptions = 4;

          const response = await send(
            `${web}/_api/web/GetList(@listUrl)/RenderListDataAsStream${listParam}`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json;odata=nometadata',
                'Content-Type': 'application/json;odata=nometadata',
                'X-RequestDigest': await formDigest(),
              },
              credentials: 'same-origin',
              body: JSON.stringify({ parameters }),
            }
          );
          const body = await response.json();
          const page = SPL.rows.fromResponse(body);

          page.columns = withSchema ? SPL.rows.columns(body) : null;

          return page;
        },
      };
    },
  };

  function retryDelay(response, attempt) {
    const header = Number(response.headers.get('Retry-After'));

    return Number.isFinite(header) && header > 0 ? header * 1000 : BACKOFF_MS[attempt];
  }

  async function failure(response) {
    const message = await errorMessage(response);

    if (response.status === 401) {
      return new ApiError('session-expired', 'Sign-in expired — reload the page.');
    }

    if (response.status === 403) {
      return new ApiError('forbidden', 'You do not have permission to read this list.');
    }

    if (response.status === 404) {
      return new ApiError('not-found', 'That list could not be found.');
    }

    if (/list view threshold/i.test(message)) return new ApiError('threshold', message);

    return new ApiError('failed', message || `SharePoint returned ${response.status}.`);
  }

  async function errorMessage(response) {
    try {
      const body = await response.json();
      const error = body['odata.error'] || body.error;

      if (!error) return '';

      return typeof error.message === 'string' ? error.message : error.message.value || '';
    } catch {
      return '';
    }
  }
})((globalThis.SPL = globalThis.SPL || {}));
