import Base58 = require("bs58");
import * as crypto from "crypto";
import * as http from "http";
import * as https from "https";
import { log, util } from "vortex-api";
import { deflateRaw } from "zlib";
import { PRIVATEBIN_HOST } from "./constants";
import format, { FormatterMarkdown } from "./format";
import { IReport } from "./IReport";

type Encryption = "aes";
type EncryptionMode = "ctr" | "cbc" | "gcm";
type KeySize = 128 | 196 | 256;
type TagSize = 32 | 64 | 96 | 104 | 112 | 120 | 128;
type Compression = "zlib" | "none";
type Format = "plaintext" | "syntaxhighlighting" | "markdown";
// not sure what options exist
type ExpireTime =
  | "5min"
  | "10min"
  | "1hour"
  | "1day"
  | "1week"
  | "1month"
  | "1year"
  | "never";

type InitializationVector = string;
type Salt = string;
type Iterations = number;

type Bool = 0 | 1;

type AEncData = [
  InitializationVector,
  Salt,
  Iterations,
  KeySize,
  TagSize,
  Encryption,
  EncryptionMode,
  Compression,
];
// encryption information. the two numerical parameters are actually booleans,
// first is whether discussions should be allowed (0 = no, 1 = yes) and second whether the message
// should be deleted immediately after it's read (0 = no, 1 = yes)
type AData = [AEncData, Format, Bool, Bool];

// this is total overkill for our purposes but it doesn't hurt
const ITERATIONS = 100000;
const KEY_SIZE: KeySize = 256;

interface IPrivateBinRequest {
  // version. privatebin v1.3 uses api version 2
  v: 1 | 2;
  adata: AData;
  // cipher text = encrypted data
  ct: string;
  // options
  meta: {
    expire: ExpireTime;
  };
}

interface IPrivateBinResponse {
  // status, 0 = success
  status: number;
  pasteId: string;
  // url. should be serverAddress?pasteId
  url: string;
  deleteToken: string;
}

async function doRequest(data: any): Promise<string> {
  const stringified = JSON.stringify(data);
  const options: https.RequestOptions = {
    host: PRIVATEBIN_HOST,
    method: "POST",
    protocol: "https:",
    path: "/",
    headers: {
      "X-Requested-With": "JSONHttpRequest",
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(stringified),
    },
  };

  return new Promise((resolve, reject) => {
    const clientRequest = https.request(options, (res) => {
      let body = Buffer.from([]);
      res
        .on("data", (chunk: Buffer) => {
          body = Buffer.concat([body, chunk]);
        })
        .on("error", (err) => {
          reject(err);
        })
        .on("end", () => {
          resolve(body.toString());
        });
    });

    clientRequest.on("error", (err) => {
      reject(err);
    });
    clientRequest.write(stringified);
    clientRequest.end();
  });
}

async function cipherText(
  cipher: crypto.CipherGCM,
  data: crypto.BinaryLike,
): Promise<Buffer> {
  const compressed = await (util as any).toPromise((cb) =>
    deflateRaw(data, cb),
  );
  return Buffer.concat([
    cipher.update(compressed),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}

async function binUpload(
  report: IReport,
): Promise<{ id: string; url: string }> {
  let formatted = format(new FormatterMarkdown(), report);
  // the privatebin pages have a footer with no visual separation from the content so
  // we append a horizontal line to work around that
  formatted += "\n---\n";

  formatted = JSON.stringify({ paste: formatted });

  let response: string;
  const iv: Buffer = crypto.randomBytes(16);
  const salt: Buffer = crypto.randomBytes(8);

  // random password, the paste only has to be accessible through the link
  const password = crypto.randomBytes(32);

  const key = await (util as any).toPromise((cb) =>
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_SIZE / 8, "sha256", cb),
  );

  const cipherType: crypto.CipherGCMTypes = `aes-${KEY_SIZE}-gcm` as any;
  const cipher = crypto.createCipheriv(cipherType, key, iv, {
    authTagLength: 16,
  });
  const adata: AData = [
    [
      iv.toString("base64"),
      salt.toString("base64"),
      ITERATIONS,
      KEY_SIZE,
      128,
      "aes",
      "gcm",
      "zlib",
    ],
    "markdown",
    1,
    0,
  ];
  cipher.setAAD(Buffer.from(JSON.stringify(adata), "utf8"));
  const request: IPrivateBinRequest = {
    v: 2,
    adata,
    ct: (await cipherText(cipher, formatted)).toString("base64"),
    meta: {
      expire: "1week",
    },
  };
  response = await doRequest(request);
  try {
    const parsed: IPrivateBinResponse = JSON.parse(response);
    return {
      id: parsed.pasteId,
      url: `https://${PRIVATEBIN_HOST}${parsed.url}#${Base58.encode(password)}`,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      err = new Error("report upload server temporarily unavailable");
      err["allowReport"] = false;
    }
    log("warn", "upload to privatebin failed", { response });
    err["attachLogOnReport"] = true;
    throw err;
  }
}

export default binUpload;
