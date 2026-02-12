import { createAction } from 'redux-act';

// Action to track plugins installed during collection sessions.
// Mirrors the action defined in collections extension so its reducer handles it.

export interface ITrackCollectionPlugins {
  type: "COLLECTION_TRACK_PLUGINS";
  payload: { sessionId: string, pluginNames: string[] };
}

export const trackCollectionPlugins = (sessionId: string, pluginNames: string[]): ITrackCollectionPlugins => ({
  type: "COLLECTION_TRACK_PLUGINS",
  payload: {
    sessionId,
    pluginNames
  },
});