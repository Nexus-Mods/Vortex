import { stat } from "node:fs/promises";
import * as path from "path";

import type { ICollectionManifest, ICreateCollectionResult } from "@nexusmods/nexus-api";
import { uploadHeadersFor } from "@vortex/nexus-api-v3";

import { log } from "../../../logging";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { MULTIPART_THRESHOLD } from "../constants";
import { createVortexNexusV3Client } from "../nexusV3Client";
import { isLoggedIn } from "../selectors";
import { toV3CollectionPayload } from "./manifestMapping";
import type { UploadProgressHandler } from "./uploadV3";
import { pollUploadAvailable, uploadFile, uploadS3Multipart } from "./uploadV3";

export type SubmitCollectionOptions = {
  onProgress?: UploadProgressHandler;
  /** Aborting stops the transfer; the upload session is then abandoned. */
  abortSignal?: AbortSignal;
};

export async function submitCollectionV3(
  api: IExtensionApi,
  collectionInfo: ICollectionManifest,
  assetFilePath: string,
  collectionId: number | undefined,
  options: SubmitCollectionOptions = {},
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
  //
  // Aborting mid-transfer abandons the session rather than releasing it: the v3
  // API exposes no way to cancel or delete one (its only upload operations are
  // create, create-multipart, finalise and get). An abandoned session is never
  // finalised, so it stays `created` and is never referenced by a collection;
  // any parts already written rely on the storage's own cleanup.
  let uploadId: string;

  // The session is presigned against these header values; they have to be sent
  // back verbatim on the transfer.
  const headers = uploadHeadersFor(filename);
  const { onProgress, abortSignal } = options;

  if (fileSize <= MULTIPART_THRESHOLD) {
    const upload = await client.createUpload(fileSize, filename);
    uploadId = upload.id;
    await uploadFile(upload.presigned_url, assetFilePath, fileSize, {
      headers,
      onProgress,
      abortSignal,
    });
  } else {
    const multipart = await client.createMultipartUpload(fileSize, filename);
    uploadId = multipart.id;
    await uploadS3Multipart(multipart, assetFilePath, fileSize, {
      headers,
      onProgress,
      abortSignal,
    });
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
