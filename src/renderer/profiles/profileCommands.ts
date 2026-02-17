import type { ProfileCommandResult } from '../../shared/profiles/commands';
import type { IProfile } from '../../extensions/profile_management/types/IProfile';

export function createProfile(profile: IProfile): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({ type: 'profile:create', profile });
}

export function removeProfile(profileId: string): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({ type: 'profile:remove', profileId });
}

export function switchProfile(profileId: string | undefined): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({ type: 'profile:switch', profileId });
}

export function enableMod(profileId: string, modId: string): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({
    type: 'profile:set-mod-enabled', profileId, modId, enabled: true,
  });
}

export function disableMod(profileId: string, modId: string): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({
    type: 'profile:set-mod-enabled', profileId, modId, enabled: false,
  });
}

export function enableMods(
  profileId: string,
  modIds: string[],
  options?: { installed?: boolean; allowAutoDeploy?: boolean },
): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({
    type: 'profile:set-mods-enabled', profileId, modIds, enabled: true, options,
  });
}

export function disableMods(
  profileId: string,
  modIds: string[],
  options?: { installed?: boolean; allowAutoDeploy?: boolean },
): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({
    type: 'profile:set-mods-enabled', profileId, modIds, enabled: false, options,
  });
}

export function setFeature(
  profileId: string, featureId: string, value: unknown,
): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({
    type: 'profile:set-feature', profileId, featureId, value,
  });
}

export function forgetMod(profileId: string, modId: string): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({ type: 'profile:forget-mod', profileId, modId });
}

export function setActivated(profileId: string): Promise<ProfileCommandResult> {
  return window.api.profile.executeCommand({ type: 'profile:set-activated', profileId });
}
