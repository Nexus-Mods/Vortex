import type { VortexModStagingFolder } from "@vortex/shared";

import type { IInstallResult } from "./IInstallResult";
import type { IChoiceType, IModAttributes, IModReference } from "./IMod";

export type ProgressDelegate = (perc: number) => void;
export interface IInstallationDetails {
  // At time of writing, this is primarily used to avoid using stop patterns
  //  when instructions are being overridden by an instructions override file.
  hasInstructionsOverrideFile?: boolean;
  modReference?: IModReference;
  // attributes of the mod this install replaces, updates or reinstalls, if any. The old mod may
  // already be removed from the state by the time the installer runs, so this is the only
  // reliable way to read what the previous install decided.
  previousAttributes?: IModAttributes;
  // the staging folder the mod is installed to, which is the source of the files deployed from it
  stagingFolder?: VortexModStagingFolder;
  // the staging folder of the mod this install replaces, updates or reinstalls, if any. It is the
  // source of the files that mod has deployed, and can differ from the folder above.
  previousStagingFolder?: VortexModStagingFolder;
  // id of the download being installed, the key of its "install-mod" batch context. Not set when
  // the install doesn't come from a download.
  archiveId?: string;
  hasXmlConfigXML?: boolean;
  hasCSScripts?: boolean;
  isTrusted?: boolean;
}

export type InstallFunc = (
  files: string[],
  destinationPath: string,
  gameId: string,
  progressDelegate: ProgressDelegate,
  choices?: IChoiceType,
  unattended?: boolean,
  archivePath?: string,
  options?: IInstallationDetails,
) => PromiseLike<IInstallResult>;
