import * as path from "path";

import { QualifiedPath } from "@vortex/shared/filesystem";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { activeGameId } from "@/util/selectors";

import { setDeploymentNecessary } from "../../actions/deployment";
import { setINITweakEnabled } from "../../actions/mods";
import { INI_TWEAKS_PATH } from "../../InstallManager";
import { installPath } from "../../selectors";
import type { IModWithState } from "../../types/IModProps";
import type { ModProperty } from "../use_mod_properties/useModProperties.hook";

const NO_TWEAKS: string[] = [];

/**
 * An optional INI edit's name, from a file named for it and the INI it edits, e.g. "Bright" from
 * "Bright[Skyrim].ini", as the legacy list reads it; none for any other file, such as one named
 * after the game's own INI, which is always applied, so is no option.
 */
const tweakName = (fileName: string) => /^(.*)\[.*\]\.ini$/i.exec(fileName)?.[1].trim();

/** The optional INI edit files in a folder; none where it can't be listed, as most mods have none. */
const listTweaks = async (folder: string): Promise<string[]> => {
  try {
    const names: string[] = [];
    const files = await window.api.fs.enumerateDirectory(QualifiedPath.fromNative(folder), {
      types: "files",
    });
    for await (const file of files) {
      if (tweakName(file.basename)) {
        names.push(file.basename);
      }
    }
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return NO_TWEAKS;
  }
};

/**
 * The optional INI edits one installed mod ships in its "Ini Tweaks" folder, as switches named for
 * the edit: on for those the user has on. Turning one on or off marks the game as needing a
 * deployment, which is when edits are applied. Several mods, or one not installed, have none.
 */
export const useIniTweaks = (mods: IModWithState[]): ModProperty[] => {
  const dispatch = useDispatch();
  const gameId = useSelector(activeGameId);
  const staging = useSelector(installPath);
  const [mod] = mods;
  const folder =
    mods.length === 1 && mod.state === "installed" && mod.installationPath && staging
      ? path.join(staging, mod.installationPath, INI_TWEAKS_PATH)
      : undefined;

  const [listed, setListed] = useState<{ folder: string; names: string[] }>();

  useEffect(() => {
    if (folder === undefined) {
      return undefined;
    }

    let current = true;
    void listTweaks(folder).then((names) => {
      if (current) {
        setListed({ folder, names });
      }
    });
    return () => {
      current = false;
    };
  }, [folder]);

  // A listing of another mod's folder is out of date, until this one's comes.
  const names = listed !== undefined && listed.folder === folder ? listed.names : NO_TWEAKS;
  const enabled = mod?.enabledINITweaks;

  return useMemo(
    () =>
      names.map((name) => ({
        kind: "switch",
        id: `iniTweak:${name}`,
        label: tweakName(name) ?? name,
        checked: enabled?.includes(name) ?? false,
        onChange: (checked: boolean) => {
          dispatch(setINITweakEnabled(gameId, mod.id, name, checked));
          dispatch(setDeploymentNecessary(gameId, true));
        },
      })),
    [dispatch, enabled, gameId, mod?.id, names],
  );
};
