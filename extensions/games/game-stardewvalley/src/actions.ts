import { createAction } from 'redux-act';

export const setRecommendations = createAction('SET_SDV_RECOMMENDATIONS', (enabled: boolean) => enabled);

export const setMergeConfigs = createAction('SET_SDV_MERGE_CONFIGS', (profileId: string, enabled: boolean) => ({ profileId, enabled }));
