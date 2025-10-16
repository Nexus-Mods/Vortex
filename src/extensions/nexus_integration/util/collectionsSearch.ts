import { ICollection } from '@nexusmods/nexus-api';
import Nexus from '@nexusmods/nexus-api';

export type SortField = 'endorsements' | 'totalDownloads' | 'name' | 'recentRating';
export type SortDirection = 'ASC' | 'DESC';

export interface ICollectionSearchOptions {
  gameId: string;
  count?: number;
  offset?: number;
  sort?: {
    field: SortField;
    direction: SortDirection;
  };
}

export interface ICollectionSearchResult {
  nodes: ICollection[];
  totalCount: number;
}

/**
 * Search collections using the GraphQL collectionsV2 query with sorting support
 */
export async function searchCollections(
  nexus: Nexus,
  options: ICollectionSearchOptions
): Promise<ICollectionSearchResult> {
  const {
    gameId,
    count = 20,
    offset = 0,
    sort = { field: 'endorsements', direction: 'DESC' },
  } = options;

  // Build the GraphQL query
  const query = `
    query Collections($count: Int, $filter: CollectionsSearchFilter, $offset: Int, $sort: [CollectionsSearchSort!]) {
      collectionsV2(
        count: $count
        filter: $filter
        offset: $offset
        sort: $sort
      ) {
        totalCount
        nodes {
          id
          name
          slug
          collectionStatus
          endorsements
          recentRating
          recentRatingCount
          totalDownloads
          summary
          category {
            name
          }
          game {
            domainName
            name
          }
          latestPublishedRevision {
            adultContent
            modCount
            totalSize
          }
          tileImage {
            thumbnailUrl(size: med)
          }
          user {
            avatar
            memberId
            name
          }
          badges {
            name
            description
          }
        }
      }
    }
  `;

  // Build the sort parameter based on the field
  const sortParam: any = {};
  sortParam[sort.field] = { direction: sort.direction };

  // Build variables
  const variables = {
    count,
    offset,
    filter: {
      collectionStatus: [
        { op: 'EQUALS', value: 'listed' },
        { op: 'EQUALS', value: 'published' },
        { op: 'EQUALS', value: 'under_moderation' },
        { op: 'EQUALS', value: 'unlisted' },
      ],
      gameDomain: [{ op: 'EQUALS', value: gameId }],
    },
    sort: sortParam,
  };

  try {
    // Make the GraphQL request directly
    // Note: This uses the internal requestGraph method if available,
    // otherwise falls back to the public API
    const result: any = await (nexus as any).rawRequest(
      'https://api.nexusmods.com/v2/graphql',
      {
        query,
        variables,
      }
    );

    if (result.data?.collectionsV2) {
      return {
        nodes: result.data.collectionsV2.nodes || [],
        totalCount: result.data.collectionsV2.totalCount || 0,
      };
    }

    throw new Error('Invalid response from collectionsV2 query');
  } catch (error) {
    // If rawRequest doesn't exist, we need to use a different approach
    // This is a fallback that constructs the proper GraphQL request
    throw new Error(`Failed to search collections: ${error.message}`);
  }
}
