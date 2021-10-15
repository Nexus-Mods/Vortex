import { ICollectionQuery, IRevisionQuery } from '@nexusmods/nexus-api';

const revisionInfo: IRevisionQuery = {
  id: true,
  revision: true,
  adultContent: true,
  createdAt: true,
  updatedAt: true,
  downloadLink: true,
  fileSize: true,
  rating: {
    average: true,
    total: true,
  },
  status: true,
  modFiles: {
    file: {
      mod: {
        author: true,
        description: true,
        category: true,
        modCategory: {
          id: true,
          name: true,
        },
        name: true,
        pictureUrl: true,
        summary: true,
        version: true,
      },
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
        memberId: true,
      },
    },
  },
};

export const FULL_COLLECTION_INFO: ICollectionQuery = {
  id: true,
  slug: true,
  name: true,
  endorsements: true,
  user: {
    name: true,
    avatar: true,
    memberId: true,
  },
  game: {
    domainName: true,
  },
  createdAt: true,
  updatedAt: true,
  tileImage: {
    url: true,
  },
  currentRevision: revisionInfo,
  description: true,
  summary: true,
} as any;

export const FULL_REVISION_INFO: IRevisionQuery = {
  ...revisionInfo,
  collection: FULL_COLLECTION_INFO,
};
