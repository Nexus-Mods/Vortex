import type { ProfileLifecycleEvent } from "../../shared/profiles/events";

/**
 * Bridge between profile lifecycle events from main process
 * and the renderer's extension event system (api.events).
 *
 * The Redux state updates for profile changes flow through state:patch
 * (generic, handled by statePatchHandler). This bridge only handles
 * extension-facing lifecycle events.
 */

type EventEmitter = {
  emit: (event: string, ...args: unknown[]) => void;
};

/**
 * Set up the profile event bridge.
 *
 * @param events - The extension event emitter (api.events)
 */
export function setupProfileEventBridge(events: EventEmitter): () => void {
  return window.api.profile.onEvent((event: ProfileLifecycleEvent) => {
    switch (event.type) {
      case "profile-will-change":
        events.emit("profile-will-change", event.profileId);
        break;

      case "profile-did-change":
        events.emit("profile-did-change", event.profileId);
        break;

      case "mod-enabled":
        events.emit("mod-enabled", event.profileId, event.modId);
        break;

      case "mod-disabled":
        events.emit("mod-disabled", event.profileId, event.modId);
        break;

      case "mods-enabled":
        events.emit(
          "mods-enabled",
          event.modIds,
          event.enabled,
          event.gameId,
          event.options,
        );
        break;

      case "request-deploy": {
        // Renderer handles deploy and responds when done
        const deployDone = new Promise<void>((resolve) => {
          events.emit("deploy-mods", () => resolve());
        });
        deployDone.then(() => {
          window.api.profile.respondToEvent(event.requestId);
        });
        break;
      }

      case "request-enqueue-work": {
        // Renderer collects enqueued work items and responds
        const workItems: unknown[] = [];
        const enqueue = (item: unknown) => workItems.push(item);
        events.emit("profile-will-change", event.profileId, enqueue);
        // Respond with collected work items
        window.api.profile.respondToEvent(event.requestId, { workItems });
        break;
      }
    }
  });
}
