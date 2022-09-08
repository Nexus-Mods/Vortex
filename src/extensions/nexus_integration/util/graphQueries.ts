import { ICollectionQuery, IRevisionQuery } from '@nexusmods/nexus-api';

const revisionInfo: IRevisionQuery = {
  id: true,
  revisionNumber: true,
  adultContent: true,
  collectionChangelog: {
    createdAt: true,
    description: true,
    id: true,
  },
  createdAt: true,
  updatedAt: true,
  downloadLink: true,
  fileSize: true,
  gameVersions: {
    id: true,
    reference: true,
  },
  rating: {
    average: true,
    total: true,
  },
  metadata: {
    ratingValue: true,
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
        status: true,
        summary: true,
        uploader: {
          name: true,
          avatar: true,
          memberId: true,
        },
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
  revisions: {
    id: true,
    revisionNumber: true,
    revisionStatus: true,
  },
  description: true,
  summary: true,
  forumTopic: {
    postsCount: true,
  },
  commentLink: true,
};

export const FULL_REVISION_INFO: IRevisionQuery = {
  ...revisionInfo,
  collection: FULL_COLLECTION_INFO,
};

export const CURRENT_REVISION_INFO: ICollectionQuery = {
  currentRevision: FULL_REVISION_INFO,
};
