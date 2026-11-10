import type { VortexProfileId } from "@vortex/shared";

import type { IProfile } from "./IProfile";

export class CorruptActiveProfile extends Error {
  constructor(profile: IProfile) {
    super(
      "The active profile is corrupted, please create a new one.\n" +
        `Profile: ${JSON.stringify(profile)}`,
    );
  }
}

/** The deployments a profile switch runs, in order. */
export const ProfileSwitchStep = {
  PendingProfile: "pending-profile",
  PreviousProfile: "previous-profile",
  NextProfile: "next-profile",
} as const;
export type ProfileSwitchStep = (typeof ProfileSwitchStep)[keyof typeof ProfileSwitchStep];

declare module "@vortex/shared/errors" {
  interface VortexErrorKindMap {
    /** A deployment the profile switch ran failed, so the switch was cancelled. */
    "profile-switch:deploy-failed": { step: ProfileSwitchStep; profileId: VortexProfileId };
  }
}
