import type Nexus from "@nexusmods/nexus-api";
import type {
  ICollectionManifest,
  ICreateCollectionResult,
} from "@nexusmods/nexus-api";

import { createNexusV3Client } from "@vortex/nexus-api-v3";
import * as fs from "fs-extra";

import type { IState } from "../../../types/IState";

import { log } from "../../../util/log";
import { MULTIPART_THRESHOLD, NEXUS_V3_BASE_URL } from "../constants";
import { hasConfidentialWithNexus } from "../guards";
import { apiKey as apiKeySelector } from "../selectors";
import { toV3CollectionPayload } from "./manifestMapping";
import {
  pollUploadAvailable,
  uploadMultipart,
  uploadSinglePart,
} from "./uploadV3";

function createClientFromState(state: IState) {
  if (!hasConfidentialWithNexus(state.confidential)) {
    throw new Error("Not logged in to Nexus Mods");
  }

  const nexusAccount = state.confidential.account.nexus;
  const apiKey = apiKeySelector(state);
  const oauthCredentials = nexusAccount.OAuthCredentials as
    | { token?: string }
    | undefined;
  const oauthToken = oauthCredentials?.token;

  return createNexusV3Client({
    baseUrl: NEXUS_V3_BASE_URL,
    apiKey,
    bearerToken: oauthToken,
  });
}

async function fetchCollectionDetails(
  nexus: Nexus,
  collectionId: number,
): Promise<ICreateCollectionResult> {
  log("debug", "calling getMyCollections", { collectionId });
  const collections = await nexus.getMyCollections(
    {
      id: true,
      slug: true,
      currentRevision: {
        id: true,
        revisionNumber: true,
        status: true,
      },
    },
    undefined,
    100,
    0,
  );
  log("debug", "getMyCollections returned", {
    count: collections.length,
    ids: collections.map((c) => c.id),
  });

  const collection = collections.find((c) => c.id === collectionId);
  if (collection) {
    return {
      collection: { id: collection.id, slug: collection.slug },
      revision: collection.currentRevision
        ? {
            id: collection.currentRevision.id,
            revisionNumber: collection.currentRevision.revisionNumber,
            revisionStatus: collection.currentRevision.status,
          }
        : undefined,
      success: true,
    };
  }

  log("warn", "collection not found in getMyCollections", { collectionId });
  return {
    collection: { id: collectionId },
    revision: undefined,
    success: true,
  };
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

  // Step 2: Finalise upload
  log("debug", "finalising upload", { uploadId });
  await client.finaliseUpload(uploadId);

  // Step 3: Poll until available
  log("debug", "polling upload availability", { uploadId });
  await pollUploadAvailable(client, uploadId);
  log("debug", "upload available", { uploadId });

  // Step 4: Create collection or revision
  const payload = toV3CollectionPayload(collectionInfo);

  let createdCollectionId: number;

  if (collectionId === undefined) {
    log("debug", "creating new collection", { uploadId });
    const result = await client.createCollection(uploadId, payload);
    createdCollectionId = Number(result.id);
    log("info", "collection created", { collectionId: createdCollectionId });
  } else {
    log("debug", "creating new revision", { uploadId, collectionId });
    await client.createCollectionRevision(
      String(collectionId),
      uploadId,
      payload,
    );
    createdCollectionId = collectionId;
    log("info", "revision created", { collectionId: createdCollectionId });
  }

  // Step 5: Fetch full details via GraphQL (slug, revisionNumber, etc.)
  return fetchCollectionDetails(nexus, createdCollectionId);
}
