import { stat } from "node:fs/promises";
import * as path from "path";

import type { ICollectionManifest, ICreateCollectionResult } from "@nexusmods/nexus-api";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { MULTIPART_THRESHOLD } from "../constants";
import { createVortexNexusV3Client } from "../nexusV3Client";
import { isLoggedIn } from "../selectors";
import { toV3CollectionPayload } from "./manifestMapping";
import { pollUploadAvailable, uploadMultipart, uploadSinglePart } from "./uploadV3";

export async function submitCollectionV3(
  api: IExtensionApi,
  collectionInfo: ICollectionManifest,
  assetFilePath: string,
  collectionId: number | undefined,
): Promise<ICreateCollectionResult> {
  if (!isLoggedIn(api.getState())) {
    throw new Error("Not logged in to Nexus Mods");
  }

  const client = createVortexNexusV3Client(api);
  const { size: fileSize } = await stat(assetFilePath);
  const filename = path.basename(assetFilePath);

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

  // Update the collection details
  await client.editCollection(collectionId, { name: collectionInfo.info.name });

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
