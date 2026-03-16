import { createAction } from 'redux-act';

/**
 * Redux actions for Stardew Valley extension settings.
 *
 * State targets:
 * - `setRecommendations` -> `settings.SDV.useRecommendations`
 * - `setMergeConfigs` -> `settings.SDV.mergeConfigs[profileId]`
 */
export const setRecommendations = createAction('SET_SDV_RECOMMENDATIONS', (enabled: boolean) => enabled);

export const setMergeConfigs = createAction('SET_SDV_MERGE_CONFIGS', (profileId: string, enabled: boolean) => ({ profileId, enabled }));
