#!/usr/bin/env node
// Summarise the manifest (collection.json) of one or more Nexus Mods collections: how many mod
// rules each defines, of which types, and how many of its mods are optional.
//
//   node .claude/skills/_shared/scripts/collection-manifest.mjs <slug>[@<revision>] ...
//
// Reads the personal API key from NEXUS_API_KEY. Prints one JSON object per collection and never
// prints the key or a download URL. Without a revision it reads the latest one.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GRAPHQL_URL = "https://api.nexusmods.com/v2/graphql";
const API_ORIGIN = "https://api.nexusmods.com";

const REVISION_QUERY = `
  query Revision($slug: String!, $revision: Int) {
    collectionRevision(slug: $slug, revision: $revision, viewAdultContent: true) {
      revisionNumber
      downloadLink
      collection { name }
    }
  }`;

/** The 7-Zip binary for this platform, from the copy the app itself depends on. */
function sevenZipPath() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const fromMain = createRequire(path.join(repoRoot, "src/main/package.json"));
  const fromNode7z = createRequire(fromMain.resolve("node-7z"));
  return fromNode7z("7zip-bin").path7za;
}

async function graphql(query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors !== undefined) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }
  return body.data;
}

/** True when a modRule endpoint matches one of the collection's own member mods. */
function isInternalRef(ref, mods) {
  if (!ref) {
    return false;
  }
  return mods.some((mod) => {
    const src = mod.source ?? {};
    if (ref.tag !== undefined && src.tag !== undefined && ref.tag === src.tag) {
      return true;
    }
    if (ref.fileMD5 !== undefined && src.md5 !== undefined && ref.fileMD5 === src.md5) {
      return true;
    }
    if (ref.md5Hint !== undefined && src.md5 !== undefined && ref.md5Hint === src.md5) {
      return true;
    }
    if (
      ref.repo?.modId !== undefined &&
      src.modId !== undefined &&
      String(ref.repo.modId) === String(src.modId)
    ) {
      return true;
    }
    if (
      ref.logicalFileName !== undefined &&
      src.logicalFilename !== undefined &&
      ref.logicalFileName === src.logicalFilename
    ) {
      return true;
    }
    if (ref.fileExpression !== undefined) {
      if (src.fileExpression === ref.fileExpression) {
        return true;
      }
      if (src.logicalFilename !== undefined && src.logicalFilename.startsWith(ref.fileExpression)) {
        return true;
      }
    }
    if (ref.idHint !== undefined && mod.name !== undefined && ref.idHint.startsWith(mod.name)) {
      return true;
    }
    return false;
  });
}

async function readManifest(slug, revision, apiKey, sevenZip, workDir) {
  const { collectionRevision } = await graphql(REVISION_QUERY, { slug, revision });
  if (collectionRevision === null) {
    throw new Error("no such collection or revision");
  }

  const linkResponse = await fetch(API_ORIGIN + collectionRevision.downloadLink, {
    headers: { apikey: apiKey },
  });
  if (!linkResponse.ok) {
    throw new Error(`download link request failed with HTTP ${linkResponse.status}`);
  }
  const links = await linkResponse.json();
  const uri = (links.download_links ?? links)[0]?.URI;
  if (uri === undefined) {
    throw new Error("the download link response named no archive");
  }

  const archiveResponse = await fetch(uri);
  if (!archiveResponse.ok) {
    throw new Error(`archive download failed with HTTP ${archiveResponse.status}`);
  }
  const archivePath = path.join(workDir, `${slug}.7z`);
  fs.writeFileSync(archivePath, Buffer.from(await archiveResponse.arrayBuffer()));

  const extractDir = path.join(workDir, slug);
  execFileSync(sevenZip, ["x", "-y", `-o${extractDir}`, archivePath, "collection.json"], {
    stdio: "ignore",
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, "collection.json"), "utf8"));

  const rules = manifest.modRules ?? [];
  const ruleTypes = {};
  for (const rule of rules) {
    ruleTypes[rule.type] = (ruleTypes[rule.type] ?? 0) + 1;
  }
  const mods = manifest.mods ?? [];
  const externalModRules = rules.filter(
    (rule) => !isInternalRef(rule.source, mods) || !isInternalRef(rule.reference, mods),
  ).length;
  return {
    slug,
    name: collectionRevision.collection.name,
    revision: collectionRevision.revisionNumber,
    mods: mods.length,
    optionalMods: mods.filter((mod) => mod.optional === true).length,
    modRules: rules.length,
    externalModRules,
    ruleTypes,
  };
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("usage: collection-manifest.mjs <slug>[@<revision>] ...");
    process.exitCode = 2;
    return;
  }
  const apiKey = process.env.NEXUS_API_KEY;
  if (!apiKey) {
    console.error("NEXUS_API_KEY is not set");
    process.exitCode = 2;
    return;
  }

  const sevenZip = sevenZipPath();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "collection-manifest-"));
  try {
    for (const target of targets) {
      const [slug, revisionText] = target.split("@");
      const revision = revisionText === undefined ? undefined : Number(revisionText);
      try {
        console.log(JSON.stringify(await readManifest(slug, revision, apiKey, sevenZip, workDir)));
      } catch (error) {
        console.log(
          JSON.stringify({ slug, error: error instanceof Error ? error.message : String(error) }),
        );
        process.exitCode = 1;
      }
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

await main();
