/**
 * IPC channel constants for health check extension
 */

export const IPC_CHANNELS = {
  RUN_PREDEFINED: "health-check:run-predefined",
  LIST_PREDEFINED: "health-check:list-predefined",
  SHARED_BUFFER_READY: "health-check:shared-buffer-ready",
  NEXUS_BRIDGE_BUFFER_READY: "health-check:nexus-bridge-buffer-ready",
  GET_MOD_REQUIREMENTS: "health-check:get-mod-requirements",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
