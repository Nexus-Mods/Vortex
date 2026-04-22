import type {
  ICollectionManifest,
  ICreateCollectionResult,
  IOAuthCredentials,
  default as Nexus,
} from "@nexusmods/nexus-api";

import { createNexusV3Client } from "@vortex/nexus-api-v3";
import * as fs from "fs-extra";

import type { IState } from "../../../types/IState";

import { log } from "../../../logging";
import { MULTIPART_THRESHOLD, NEXUS_V3_BASE_URL } from "../constants";
import { apiKey as apiKeySelector, isLoggedIn } from "../selectors";
import { toV3CollectionPayload } from "./manifestMapping";
import {
  pollUploadAvailable,
  uploadMultipart,
  uploadSinglePart,
} from "./uploadV3";

function createClientFromState(state: IState) {
  if (!isLoggedIn(state)) {
    throw new Error("Not logged in to Nexus Mods");
  }

  const apiKey = apiKeySelector(state);
  const oauthCred: IOAuthCredentials =
    state.confidential.account?.["nexus"]?.["OAuthCredentials"];
  const oauthToken = oauthCred?.token;

  return createNexusV3Client({
    baseUrl: NEXUS_V3_BASE_URL,
    apiKey,
    bearerToken: oauthToken,
  });
}

export async function submitCollectionV3(
  state: IState,
  nexus: Nexus,
  collectionInfo: ICollectionManifest,
  assetFilePath: string,
  collectionId: number | undefined,
): Promise<ICreateCollectionResult> {
  const client = createClientFromState(state);
  const stat = await fs.stat(assetFilePath);
  const fileSize = stat.size;
  const filename = assetFilePath.split(/[\\/]/).pop() ?? "collection.zip";

  log("info", "submitting collection via V3 API", {
    fileSize,
    isMultipart: fileSize > MULTIPART_THRESHOLD,
    isNewCollection: collectionId === undefined,
  });

  // Step 1: Create upload session
  let uploadId: string;

  if (fileSize <= MULTIPART_THRESHOLD) {
    const upload = await client.createUpload(fileSize, filename);
    uploadId = upload.id;
    await uploadSinglePart(upload.presigned_url, assetFilePath, fileSize);
  } else {
    const multipart = await client.createMultipartUpload(fileSize, filename);
    uploadId = multipart.id;
    await uploadMultipart(multipart, assetFilePath, fileSize);
  }

  // Step 2: Finalise and wait for availability
  await client.finaliseUpload(uploadId);
  await pollUploadAvailable(client, uploadId);

  // Step 3: Create collection or revision
  const payload = toV3CollectionPayload(collectionInfo);

  if (collectionId === undefined) {
    const result = await client.createCollection(uploadId, payload);
    return {
      collection: { id: Number(result.id), slug: result.slug },
      revision: {
        id: Number(result.revision_id),
        revisionNumber: result.revision_number,
        revisionStatus: result.revision_status,
      },
      success: true,
    };
  }

  // V3 revision creation doesn't propagate collection-level metadata (name)
  // to the parent collection. Preserve the legacy behaviour by calling
  // GraphQL editCollection first, mirroring the pre-v3 flow which ran
  // editCollection unconditionally before every revision upload.
  await nexus.editCollection(collectionId, collectionInfo.info.name);

  const revisionResult = await client.createCollectionRevision(
    String(collectionId),
    uploadId,
    payload,
  );
  // Slug is unchanged from the previous upload (caller already has it stored).
  return {
    collection: { id: collectionId },
    revision: {
      id: Number(revisionResult.id),
      revisionNumber: revisionResult.revision_number,
      revisionStatus: revisionResult.revision_status,
    },
    success: true,
  };
}
