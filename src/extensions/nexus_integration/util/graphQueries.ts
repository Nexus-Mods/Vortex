import { ICollectionQuery, IRevisionQuery } from 'nexus-api';

const revisionInfo: IRevisionQuery = {
  id: true,
  revision: true,
  adultContent: true,
  createdAt: true,
  updatedAt: true,
  downloadUri: true,
  fileSize: true,
  rating: true,
  votes: true,
  status: true,
  modFiles: {
    file: {
      modId: true,
      fileId: true,
      size: true,
      name: true,
      version: true,
      description: true,
      uri: true,
      game: {
        domainName: true,
      },
      owner: {
        name: true,
        avatar: true,
      },
    },
  },
};

export const FULL_COLLECTION_INFO: ICollectionQuery = {
  id: true,
  name: true,
  endorsements: true,
  category: true,
  user: {
    name: true,
    avatar: true,
  },
  game: {
    domainName: true,
  },
  currentRevision: revisionInfo,
};

export const FULL_REVISION_INFO: IRevisionQuery = {
  ...revisionInfo,
  collection: FULL_COLLECTION_INFO,
};
