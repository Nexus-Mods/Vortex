export function generateCollectionSessionId(collectionId: string, profileId: string): string {
  return `${collectionId}_${profileId}`;
}