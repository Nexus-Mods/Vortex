export type TelemetryEvent = EventDetectedGame;

// https://github.com/Nexus-Mods/flamework/tree/master/contracts/telemetry
export type EventDetectedGame = {
  type: "detected_games";
  version: 1;

  payload: {
    steam: string[];
    gog: string[];
    epic: string[];
  };
};
