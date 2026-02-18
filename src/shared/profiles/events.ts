/** Lifecycle events emitted from main to renderer during profile operations */
export type ProfileLifecycleEvent =
  | { type: "profile-will-change"; profileId: string | undefined }
  | {
      type: "profile-did-change";
      profileId: string | undefined;
      gameId: string | undefined;
    }
  | { type: "mod-enabled"; profileId: string; modId: string }
  | { type: "mod-disabled"; profileId: string; modId: string }
  | {
      type: "mods-enabled";
      modIds: string[];
      enabled: boolean;
      gameId: string;
      options?: { installed?: boolean; allowAutoDeploy?: boolean };
    }
  | { type: "request-deploy"; profileId: string; requestId: string }
  | { type: "request-enqueue-work"; profileId: string; requestId: string };
