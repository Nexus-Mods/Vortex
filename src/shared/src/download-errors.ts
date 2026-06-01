// Single source of truth for mapping a DownloadError to and from its wire form.
// Used by the download-state path (main serializes, renderer rehydrates) and by
// the generic error codec on the callback path, so a given payload always
// rebuilds into the same concrete error class regardless of which channel it
// travelled on. The payload's `URL` is not part of the IPC Serializable
// contract, so it crosses as a string and is rebuilt on arrival.

import { DownloadError, DownloadIsHTML, HTTPError } from "./types/errors";
import type { WireDownloadError } from "./types/ipc";

export function downloadErrorToWire(err: DownloadError): WireDownloadError {
  const { payload } = err;
  const wirePayload =
    "url" in payload ? { ...payload, url: payload.url.toString() } : { ...payload };
  return { payload: wirePayload, message: err.message };
}

export function wireToDownloadError(wire: WireDownloadError): Error {
  const { payload, message } = wire;
  switch (payload.code) {
    case "is-html":
      return new DownloadIsHTML(payload.url);
    case "network-bad-status":
      return new HTTPError(payload.statusCode, message, payload.url);
    default:
      return new DownloadError(
        "url" in payload ? { ...payload, url: new URL(payload.url) } : { ...payload },
        message,
      );
  }
}
