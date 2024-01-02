import minimatch from 'minimatch';
import * as semver from 'semver';
import { getSafe } from '../../util/storeHelper';

export function matchesGameMode<T>(entry: T,
                                   gameMode: string,
                                   forceMatch: boolean = false): boolean {
  const entryGameMode = getSafe(entry, ['gamemode'], undefined);
  if ((gameMode === undefined)
    && ((entryGameMode === undefined) || (entryGameMode === '*') || (entryGameMode === ''))) {
    return true;
  }

  return ((entryGameMode !== undefined) && (gameMode !== undefined))
  // Only compare gameModes when the entry is game specific and
  //  we have an active game mode. We use forceMatch at this point as
  //  we don't want to display announcements if the predicate fails, but
  //  we _do_ want to display surveys, so this allows us to keep the same
  //  predicate for both use cases. (bit hacky I admit..)
    ? minimatch(gameMode, entryGameMode)
    : forceMatch;
}

export function matchesVersion<T>(entry: T, appVersion: string): boolean {
  const entryVersion = getSafe(entry, ['version'], undefined);
  return (entryVersion !== undefined)
    ? semver.satisfies(appVersion, entryVersion)
    : true;
}
