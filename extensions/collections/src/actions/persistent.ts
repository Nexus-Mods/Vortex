import { ICollection, IRevision } from '@nexusmods/nexus-api';
import { createAction } from 'redux-act';

export const updateCollectionInfo = createAction(
  'UPDATE_COLLECTION_INFO',
  (collectionId: string, collectionInfo: Partial<ICollection>, timestamp: number) =>
    ({ collectionId, collectionInfo, timestamp }));

export const updateRevisionInfo = createAction(
  'UPDATE_REVISION_INFO',
  (revisionId: string, revisionInfo: Partial<IRevision>, timestamp: number) =>
    ({ revisionId, revisionInfo, timestamp }));

export const updateSuccessRate = createAction(
  'UPDATE_COLLECTION_HEALTH_RATE',
  (revisionId: string, vote: 'positive' | 'negative', average: number, total: number) =>
    ({ revisionId, vote, average, total }));

export const setPendingVote = createAction(
  'SET_REVISION_PENDING_VOTE',
  (revisionId: string, collectionSlug: string, revisionNumber: number, time: number) =>
    ({ revisionId, collectionSlug, revisionNumber, time }));

export const clearPendingVote = createAction(
  'CLEAR_REVISION_PENDING_VOTE',
  (revisionId: string) => ({ revisionId }));
