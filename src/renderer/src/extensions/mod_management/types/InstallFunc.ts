import type { IInstallResult } from "./IInstallResult";
import type { IChoiceType, IModReference } from "./IMod";

export type ProgressDelegate = (perc: number) => void;
export interface IInstallationDetails {
  // At time of writing, this is primarily used to avoid using stop patterns
  //  when instructions are being overridden by an instructions override file.
  hasInstructionsOverrideFile?: boolean;
  modReference?: IModReference;
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
