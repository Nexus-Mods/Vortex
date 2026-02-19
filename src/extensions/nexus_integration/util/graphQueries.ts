import type {
  ICollectionQuery,
  IRevisionQuery,
  IModRequirementsQuery,
  IModFileQuery,
} from "@nexusmods/nexus-api";

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
  latestPublishedRevision: {
    id: true,
    revisionNumber: true,
  },
  description: true,
  summary: true,
  forumTopic: {
    postsCount: true,
  },
  commentLink: true,
  overallRating: true,
  overallRatingCount: true,
  viewerIsBlocked: true,
  permissions: {
    global: true,
    key: true,
  },
  recentRating: true,
  recentRatingCount: true,
};

export const FULL_REVISION_INFO: IRevisionQuery = {
  ...revisionInfo,
  collection: FULL_COLLECTION_INFO,
};

export const CURRENT_REVISION_INFO: ICollectionQuery = {
  currentRevision: FULL_REVISION_INFO,
};

export const COLLECTION_SEARCH_QUERY: ICollectionQuery = {
  id: true,
  name: true,
  slug: true,
  collectionStatus: true,
  endorsements: true,
  totalDownloads: true,
  summary: true,
  badges: {
    name: true,
    description: true,
  },
  permissions: {
    global: true,
    key: true,
  },
  category: {
    name: true,
  },
  game: {
    domainName: true,
    id: true,
    name: true,
  },
  latestPublishedRevision: {
    adultContent: true,
    modCount: true,
    totalSize: true,
  },
  tileImage: {
    url: true,
    thumbnailUrl: {
      $filter: { size: "med" },
    },
  },
  user: {
    avatar: true,
    memberId: true,
    name: true,
  },
};

export const MOD_FILE_INFO: Partial<IModFileQuery> = {
  categoryId: true,
  count: true,
  date: true,
  description: true,
  fileId: true,
  mod: {
    adultContent: true,
    author: true,
    category: true,
    createdAt: true,
    description: true,
    downloads: true,
    endorsements: true,
    game: {
      id: true,
      domainName: true,
    },
    gameId: true,
    id: true,
    modCategory: {
      id: true,
      name: true,
    },
    name: true,
    pictureUrl: true,
    status: true,
    summary: true,
    uid: true,
    updatedAt: true,
    uploader: {
      avatar: true,
      memberId: true,
      name: true,
    },
    version: true,
    modRequirements: {
      dlcRequirements: {
        gameExpansion: { id: true, name: true },
        notes: true,
      },
      nexusRequirements: {
        nodes: {
          id: true,
          modId: true,
          modName: true,
          url: true,
          externalRequirement: true,
          gameId: true,
        },
        totalCount: true,
      },
    },
  },
  modId: true,
  name: true,
  owner: {
    avatar: true,
    memberId: true,
    name: true,
  },
  primary: true,
  size: true,
  sizeInBytes: true,
  totalDownloads: true,
  uniqueDownloads: true,
  uid: true,
  uri: true,
  version: true,
};

export const MOD_REQUIREMENTS_INFO: IModRequirementsQuery = {
  dlcRequirements: {
    gameExpansion: { id: true, name: true },
    notes: true,
  },
  nexusRequirements: {
    nodes: {
      id: true,
      modId: true,
      modName: true,
      url: true,
      externalRequirement: true,
    },
    totalCount: true,
  },
  modsRequiringThisMod: {
    nodes: { id: true, modId: true, modName: true },
    totalCount: true,
  },
};

export const MY_COLLECTIONS_SEARCH_QUERY: ICollectionQuery = {
  revisions: {
    id: true,
    revisionNumber: true,
    createdAt: true,
    updatedAt: true,
    rating: {
      average: true,
    },
    modCount: true,
    collection: {
      slug: true,
      name: true,
      tileImage: { url: true },
      user: { name: true, memberId: true },
      permissions: { global: true, key: true },
      game: { domainName: true },
    },
  },
};
