import { ICollectionQuery, IRevisionQuery } from 'nexus-api';

export const FULL_COLLECTION_INFO: ICollectionQuery = {
  id: true,
  name: true,
  description: true,
  category: true,
  user: {
    name: true,
    avatar: {
      url: true,
    },
  },
  game: {
    domainName: true,
  },
};

export const FULL_REVISION_INFO: IRevisionQuery = {
  id: true,
  adultContent: true,
  createdAt: true,
  updatedAt: true,
  downloadUri: true,
  fileSize: true,
  rating: true,
  votes: true,
  status: true,
  collection: FULL_COLLECTION_INFO,
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
        avatar: {
          url: true,
        },
      },
    },
  },
};
