import { gzip } from "zlib";

import type { FeedbackRecord } from "@vortex/shared";

/** The service that takes feedback. Not the Nexus Mods API: it streams what it is sent. */
export const FEEDBACK_SERVICE_URL = "https://vortex-feedback.nexusmods.com";

const RECORDS_PATH = "/v1/records";

/**
 * How long one request may take before it is given up and retried. A request is at most 7 MiB, which
 * this leaves time for on a slow link; without it a stalled connection would never settle.
 */
export const REQUEST_TIMEOUT_MS = 120_000;

/** Who is sending: the first line of every request. */
export interface IFeedbackClientInfo {
  name: string;
  version: string;
  /** The anonymous install id; left out before one is assigned. */
  instanceId: string | undefined;
}

/** One record as it is sent: the record, with the id and key that tell it apart. */
export interface IFeedbackRecordEntry {
  id: string;
  /** When the feedback was created, as an ISO timestamp. */
  occurredAt: string;
  /** What the record is of within its type; empty for a type a feedback has one record of. */
  key: string;
  record: FeedbackRecord;
}

/** The service answered, and not with success. */
export class FeedbackHttpError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(detail);
    this.name = "FeedbackHttpError";
  }
}

/**
 * A request body: the client on the first line, then one record per line. The service reads it a
 * line at a time, so a payload has to stay on its line, which `JSON.stringify` guarantees.
 */
export function encodeFeedbackRequest(
  client: IFeedbackClientInfo,
  entries: readonly IFeedbackRecordEntry[],
): string {
  const lines = [
    JSON.stringify({
      client: { name: client.name, version: client.version, instance_id: client.instanceId },
    }),
    ...entries.map(({ id, occurredAt, key, record }) =>
      JSON.stringify({
        id,
        type: record.type,
        version: record.version,
        occurred_at: occurredAt,
        feedback_id: record.payload.feedback_id,
        key,
        payload: record.payload,
      }),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function gzipText(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    gzip(text, (err, compressed) => {
      if (err !== null) {
        reject(err);
      } else {
        // a copy with a buffer of its own: Node hands back a view into a shared pool
        resolve(new Uint8Array(compressed));
      }
    });
  });
}

async function problemDetail(response: Response): Promise<string> {
  try {
    const problem: unknown = await response.json();
    if (typeof problem === "object" && problem !== null && "detail" in problem) {
      const { detail } = problem;
      if (typeof detail === "string") return detail;
    }
  } catch {
    // not a problem document, so the status has to do
  }
  return `The feedback service answered ${response.status}.`;
}

export interface IFeedbackSenderOptions {
  /** The service's address, without the path. */
  baseUrl: string;
  client: IFeedbackClientInfo;
  /** The OAuth access token the renderer holds. A 401 is reported, for it to renew the login. */
  token: string;
  signal?: AbortSignal;
  /** How long one request may take; see `REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export interface IFeedbackSendCallOptions {
  /**
   * Lets the request finish even when the caller's signal aborts, stopped only by the timeout. For
   * the request that completes a feedback: once it is out, the service may store it whatever the
   * client does, and telling the user it was canceled would hide a feedback that arrived.
   */
  finishOnCancel?: boolean;
}

export interface IFeedbackSender {
  /** Resolves once the service has stored every record; rejects otherwise, having stored none. */
  send: (
    entries: readonly IFeedbackRecordEntry[],
    options?: IFeedbackSendCallOptions,
  ) => Promise<void>;
}

/**
 * Sends records to the feedback service, compressed. The service takes the login the Nexus Mods
 * site issues and no API key.
 */
export function createFeedbackSender(options: IFeedbackSenderOptions): IFeedbackSender {
  const { baseUrl, client, token, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const doFetch = options.fetch ?? fetch;
  const url = `${baseUrl.replace(/\/+$/, "")}${RECORDS_PATH}`;

  return {
    async send(entries, { finishOnCancel = false } = {}) {
      const body = await gzipText(encodeFeedbackRequest(client, entries));
      // a timeout rejects as a failure to retry; only the caller's signal means canceled
      const timeout = AbortSignal.timeout(timeoutMs);
      const response = await doFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-ndjson",
          "Content-Encoding": "gzip",
        },
        body,
        signal:
          signal === undefined || finishOnCancel ? timeout : AbortSignal.any([signal, timeout]),
      });
      if (!response.ok) {
        throw new FeedbackHttpError(response.status, await problemDetail(response));
      }
      // nothing in it is needed, and an unread body keeps the connection from being reused
      await response.body?.cancel().catch(() => undefined);
    },
  };
}
