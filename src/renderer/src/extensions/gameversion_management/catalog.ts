import { createHash, createPublicKey, verify } from "crypto";

import type {
  IGameVersionCatalog,
  IGameVersionTransitionProvider,
  ISignedGameVersionCatalog,
} from "./types/IGameVersionTransitionProvider";

export interface ILoadedGameVersionCatalog {
  catalog: IGameVersionCatalog;
  digest: string;
}

function publicKey(input: string) {
  return input.includes("BEGIN PUBLIC KEY")
    ? createPublicKey(input)
    : createPublicKey({ key: Buffer.from(input, "base64"), format: "der", type: "spki" });
}

function validateCatalog(catalog: IGameVersionCatalog, providerId: string): void {
  if (catalog?.schemaVersion !== 1 || catalog.providerId !== providerId) {
    throw new Error("Game-version catalog identity or schema is invalid");
  }
  if (!Array.isArray(catalog.games)) {
    throw new Error("Game-version catalog has no games list");
  }
  const validHash = (value: string) => /^[a-f0-9]{64}$/i.test(value);
  const validPath = (value: string) =>
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\0") &&
    !value.split(/[\\/]/).includes("..") &&
    !/^(?:[a-z]:|[\\/])/i.test(value);
  for (const game of catalog.games) {
    if (!Array.isArray(game.targets)) {
      throw new Error("Game-version catalog target list is invalid");
    }
    for (const target of game.targets) {
      if (
        target.compatibilityNote !== undefined &&
        (typeof target.compatibilityNote !== "string" || target.compatibilityNote.length > 1000)
      ) {
        throw new Error("Game-version catalog compatibility note is invalid");
      }
      const fingerprints = [target.fingerprint, ...target.transitions.map((item) => item.source)];
      if (
        fingerprints.some(
          (fingerprint) =>
            !Array.isArray(fingerprint?.files) ||
            fingerprint.files.length === 0 ||
            fingerprint.files.some(
              (file) =>
                !validPath(file.path) ||
                !validHash(file.sha256) ||
                (file.size !== undefined && (!Number.isSafeInteger(file.size) || file.size < 0)),
            ),
        )
      ) {
        throw new Error("Game-version catalog fingerprint is invalid");
      }
      for (const transition of target.transitions) {
        if (!Array.isArray(transition.operations)) {
          throw new Error("Game-version catalog operation list is invalid");
        }
        for (const operation of transition.operations) {
          if (!validPath(operation.targetPath)) {
            throw new Error("Game-version catalog contains an unsafe path");
          }
          if (
            operation.type === "patch" &&
            (!["bsdiff40-v1", "chunk-map-v1"].includes(operation.algorithm) ||
              !validPath(operation.sourcePath) ||
              !validHash(operation.sourceSha256) ||
              !validHash(operation.targetSha256) ||
              !Number.isSafeInteger(operation.targetSize) ||
              operation.targetSize < 0 ||
              !validHash(operation.artifact?.sha256) ||
              !Number.isSafeInteger(operation.artifact?.size) ||
              operation.artifact.size < 0 ||
              new URL(operation.artifact.url).protocol !== "https:")
          ) {
            throw new Error("Game-version catalog patch operation is invalid");
          }
          if (operation.type !== "patch" && operation.type !== "remove") {
            throw new Error("Game-version catalog operation type is invalid");
          }
        }
      }
    }
  }
}

export async function loadCatalog(
  provider: IGameVersionTransitionProvider,
): Promise<ILoadedGameVersionCatalog> {
  const url = new URL(provider.catalog.url);
  if (url.protocol !== "https:") {
    throw new Error("Game-version catalogs must be served over HTTPS");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load game-version catalog (${response.status})`);
  }
  const envelope = (await response.json()) as ISignedGameVersionCatalog;
  if (envelope?.schemaVersion !== 1) {
    throw new Error("Unsupported signed game-version catalog schema");
  }
  const trustedKey = provider.catalog.trustedKeys[envelope.keyId];
  if (trustedKey === undefined) {
    throw new Error(`Untrusted game-version catalog key: ${envelope.keyId}`);
  }
  const payload = Buffer.from(envelope.payload, "base64");
  const signature = Buffer.from(envelope.signature, "base64");
  if (!verify(null, payload, publicKey(trustedKey), signature)) {
    throw new Error("Game-version catalog signature is invalid");
  }
  const catalog = JSON.parse(payload.toString("utf8")) as IGameVersionCatalog;
  validateCatalog(catalog, provider.id);
  return {
    catalog,
    digest: createHash("sha256").update(payload).digest("hex"),
  };
}

export function versionMatches(target: { version: string; aliases?: string[] }, input: string) {
  const normalized = input.trim().toLowerCase();
  return [target.version, ...(target.aliases ?? [])].some(
    (candidate) => candidate.trim().toLowerCase() === normalized,
  );
}
