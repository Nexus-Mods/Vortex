import type { IChoiceType, IFileListItem, IModPatches } from "./IMod";

export interface IInstallOptions {
  allowAutoEnable?: boolean;
  choices?: IChoiceType;
  forceInstaller?: string;
  unattended?: boolean;
  fileList?: IFileListItem[];
  patches?: IModPatches;
  variantNumber?: number;
  profileId?: string;
}
