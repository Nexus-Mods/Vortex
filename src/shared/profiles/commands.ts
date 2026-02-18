import type { IProfile } from "../../extensions/profile_management/types/IProfile";

/** Discriminated union of all profile commands */
export type ProfileCommand =
  | { type: "profile:create"; profile: IProfile }
  | { type: "profile:remove"; profileId: string }
  | { type: "profile:switch"; profileId: string | undefined }
  | {
      type: "profile:set-mod-enabled";
      profileId: string;
      modId: string;
      enabled: boolean;
    }
  | {
      type: "profile:set-mods-enabled";
      profileId: string;
      modIds: string[];
      enabled: boolean;
      options?: { installed?: boolean; allowAutoDeploy?: boolean };
    }
  | {
      type: "profile:set-feature";
      profileId: string;
      featureId: string;
      value: unknown;
    }
  | { type: "profile:forget-mod"; profileId: string; modId: string }
  | { type: "profile:set-activated"; profileId: string };

/** Result returned from executing a profile command */
export interface ProfileCommandResult {
  success: boolean;
  error?: string;
  data?: unknown;
}
