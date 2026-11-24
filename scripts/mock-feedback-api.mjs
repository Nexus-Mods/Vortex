/**
 * Local stand-in for the vortex-feedback service, for sending feedback from a dev build without
 * the real service, and for reading exactly what Vortex sent.
 *
 * Serves:
 *   POST /v1/records    the request Vortex's feedback dialog sends
 *
 * The body is JSON lines, gzip-compressed when the request says so: the client on the first
 * line, then one record per line. It answers as the real service does: 200 with the number of
 * records accepted, 401 without a bearer token, 413 over a size limit, 415 for a compression
 * other than gzip and 422 for a line that is not a valid record, with nothing saved unless the
 * whole request is accepted. The bearer token is only checked for presence, never verified or
 * written anywhere. Payloads are not checked against their contracts, which the real service does.
 *
 * Every accepted request is saved as it was sent, decompressed and otherwise untouched, in the
 * folder of the feedback it belongs to:
 *   <out>/<feedback_id>/request-001.ndjson
 *   <out>/<feedback_id>/request-002.ndjson
 * A request sent again is saved again under the next number, so a retry shows up as a second
 * file.
 *
 * Usage:
 *   node scripts/mock-feedback-api.mjs [--port 9878] [--out dir] [--status 503] [--fail-first 2]
 *
 * --status answers every request with that status instead of saving it, to see the dialog's
 * failure states (401, 413, 422, 429, 503).
 * --fail-first answers the first N requests with 503 and then behaves, to see the retries.
 *
 * Then run Vortex with:
 *   VORTEX_FEEDBACK_API_BASE=http://localhost:9878
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] != null ? argv[index + 1] : fallback;
}

const port = Number(arg("port", "9878"));
const outDir = path.resolve(arg("out", path.join(tmpdir(), "vortex-feedback-mock")));
const forcedStatus = Number(arg("status", "0"));
let failuresLeft = Number(arg("fail-first", "0"));

// the real service's limits
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const MAX_LINE_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEEDBACK_ID = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;
const TYPE = /^feedback(_[a-z0-9]+)*$/;

const TITLES = {
  401: "Unauthorized",
  404: "Not Found",
  405: "Method Not Allowed",
  413: "Request Entity Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  503: "Service Unavailable",
};

// The renderer sends this cross-origin with an Authorization header, so the browser engine asks
// first (OPTIONS) and needs these on every answer.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, Content-Encoding",
  "access-control-allow-methods": "POST, OPTIONS",
};

/** An answer other than success: a status and what was wrong. */
class Refusal extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      // keep reading past the limit so the client gets the 413 rather than a reset
      if (size <= MAX_BODY_BYTES) {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) {
        reject(new Refusal(413, "The request body is too large."));
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", reject);
  });
}

function decode(req, body) {
  const encoding = req.headers["content-encoding"] ?? "";
  if (encoding === "" || encoding === "identity") {
    return body;
  }
  if (encoding !== "gzip") {
    throw new Refusal(415, `Content-Encoding "${encoding}" is not supported. Use gzip or none.`);
  }
  try {
    return gunzipSync(body, { maxOutputLength: MAX_DECODED_BYTES });
  } catch (err) {
    if (err?.code === "ERR_BUFFER_TOO_LARGE") {
      throw new Refusal(413, "The decompressed request body is too large.");
    }
    throw new Refusal(422, "The request body is not valid gzip.");
  }
}

/** Checks every line, so that nothing is saved from a request that is refused. */
function validate(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  let head;
  try {
    head = JSON.parse(lines[0] ?? "");
  } catch {
    head = undefined;
  }
  const client = head?.client;
  if (typeof client?.name !== "string" || typeof client?.version !== "string") {
    throw new Refusal(422, 'Line 1 must be the client: {"client":{"name":...,"version":...}}.');
  }

  const records = lines.slice(1);
  if (records.length === 0) {
    throw new Refusal(422, "The request holds no records.");
  }
  if (records.length > MAX_RECORDS) {
    throw new Refusal(413, `A request may hold ${MAX_RECORDS} records.`);
  }

  return records.map((line, index) => {
    const at = `Line ${index + 2}`;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      throw new Refusal(413, `${at} is over the ${MAX_LINE_BYTES}-byte limit for one record.`);
    }
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new Refusal(422, `${at} is not a valid record: it is not JSON.`);
    }
    if (typeof record?.id !== "string" || !UUID.test(record.id)) {
      throw new Refusal(422, `${at}: id must be a UUID.`);
    }
    if (typeof record.type !== "string" || !TYPE.test(record.type)) {
      throw new Refusal(422, `${at}: type must be \`feedback\` or start with \`feedback_\`.`);
    }
    if (!Number.isInteger(record.version) || record.version < 1 || record.version > 65535) {
      throw new Refusal(422, `${at}: version must be between 1 and 65535.`);
    }
    if (typeof record.feedback_id !== "string" || !FEEDBACK_ID.test(record.feedback_id)) {
      throw new Refusal(422, `${at}: feedback_id must be a feedback id.`);
    }
    if (typeof record.key !== "string") {
      throw new Refusal(422, `${at}: key must be a string.`);
    }
    if (typeof record.occurred_at !== "string" || Number.isNaN(Date.parse(record.occurred_at))) {
      throw new Refusal(422, `${at}: occurred_at must be a timestamp.`);
    }
    const { payload } = record;
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Refusal(422, `${at}: payload must be a JSON object.`);
    }
    return record;
  });
}

/** Saves the request as it was sent, under the feedback of its first record. */
function store(records, text) {
  const dir = path.join(outDir, records[0].feedback_id);
  mkdirSync(dir, { recursive: true });

  const taken = readdirSync(dir).filter((name) => /^request-\d+\.ndjson$/.test(name)).length;
  const file = path.join(dir, `request-${String(taken + 1).padStart(3, "0")}.ndjson`);
  writeFileSync(file, text);
  return file;
}

function refuse(res, status, detail, pathname) {
  res.writeHead(status, { ...CORS, "content-type": "application/problem+json" });
  res.end(
    JSON.stringify({
      type: "about:blank",
      title: TITLES[status] ?? "Error",
      status,
      detail,
      instance: pathname,
    }),
  );
}

async function accept(req) {
  if (forcedStatus > 0) {
    await readBody(req).catch(() => undefined);
    throw new Refusal(forcedStatus, `Answering every request with ${forcedStatus} (--status).`);
  }
  if (failuresLeft > 0) {
    failuresLeft--;
    await readBody(req).catch(() => undefined);
    throw new Refusal(503, `Failing on purpose, ${failuresLeft} more to go (--fail-first).`);
  }

  const body = await readBody(req);

  if (!/^Bearer \S+/.test(req.headers.authorization ?? "")) {
    throw new Refusal(401, "Please provide a bearer token.");
  }

  const text = decode(req, body).toString("utf8");
  const records = validate(text);

  return { records, text, received: body.length };
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  const label = `${req.method} ${url.pathname}`;

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (url.pathname !== "/v1/records") {
    console.log(`${label} -> 404`);
    refuse(res, 404, "Only POST /v1/records is served.", url.pathname);
    return;
  }

  if (req.method !== "POST") {
    console.log(`${label} -> 405`);
    refuse(res, 405, "Use POST.", url.pathname);
    return;
  }

  accept(req)
    .then(({ records, text, received }) => {
      const file = store(records, text);
      const sent = Buffer.byteLength(text);
      console.log(
        `${label} -> 200 (${records.length} records, ${received} bytes received, ${sent} bytes of records)`,
      );
      console.log(`  ${file}`);
      res.writeHead(200, { ...CORS, "content-type": "application/json" });
      res.end(JSON.stringify({ data: { accepted: records.length } }));
    })
    .catch((err) => {
      const status = err instanceof Refusal ? err.status : 500;
      const detail = err instanceof Error ? err.message : String(err);
      console.log(`${label} -> ${status} (${detail})`);
      refuse(res, status, detail, url.pathname);
    });
});

// loopback only: without an explicit host Node binds 0.0.0.0, and this accepts anything sent to it
server.listen(port, "127.0.0.1", () => {
  console.log(`mock feedback service on http://localhost:${port}`);
  console.log(`  saving requests to: ${outDir}`);
  if (forcedStatus > 0) {
    console.log(`  answering every request with ${forcedStatus}`);
  }
  if (failuresLeft > 0) {
    console.log(`  answering the first ${failuresLeft} requests with 503`);
  }
  console.log("run Vortex with:");
  console.log(`  VORTEX_FEEDBACK_API_BASE=http://localhost:${port}`);
});
