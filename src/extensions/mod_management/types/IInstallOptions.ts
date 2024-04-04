import { IFileListItem } from './IMod';

export interface IInstallOptions {
  allowAutoEnable?: boolean;
  choices?: any;
  forceInstaller?: string;
  unattended?: boolean;
  fileList?: IFileListItem[];
  patches?: any;
  variantNumber?: number;
}
