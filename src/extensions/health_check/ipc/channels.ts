/**
 * IPC channel constants for health check extension
 */

export const IPC_CHANNELS = {
  RUN_PREDEFINED: "health-check:run-predefined",
  LIST_PREDEFINED: "health-check:list-predefined",
  GET_MOD_REQUIREMENTS: "health-check:get-mod-requirements",
  FETCH_CHUNK: "health-check:fetch-chunk",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
