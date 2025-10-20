export interface IAvailableExtension {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  shortDescription: string;
  homepage: string;
  repository?: { type: string, url: string };
  bugs?: { url: string };
  thumbnail?: string;
  downloads: number;
  endorsements: number;
  installTime: number;
  modId: number;
  fileId: number;
  fileName: string;
  category: string;
  custom?: boolean;
  gameVersions?: string[];
  tags?: string[];
  isUpdate?: boolean;
  rating?: number;
  dependencies?: IExtensionRequirement[];
  incompatible?: IExtensionRequirement[];
  optionalDependencies?: IExtensionRequirement[];
  suggest?: IExtensionRequirement[];
  bundled?: boolean;
  forceBundled?: boolean;
  bundledPath?: string;
  stagingPath?: string;
  [key: string]: any;
}

export interface IExtension {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  shortDescription: string;
  homepage: string;
  repository?: { type: string, url: string };
  bugs?: { url: string };
  thumbnail?: string;
  downloads: number;
  endorsements: number;
  installTime: number;
  modId: number;
  fileId: number;
  fileName: string;
  category: string;
  custom?: boolean;
  gameVersions?: string[];
  tags?: string[];
  isUpdate?: boolean;
  rating?: number;
  dependencies?: IExtensionRequirement[];
  incompatible?: IExtensionRequirement[];
  optionalDependencies?: IExtensionRequirement[];
  suggest?: IExtensionRequirement[];
  bundled?: boolean;
  forceBundled?: boolean;
  bundledPath?: string;
  stagingPath?: string;
  [key: string]: any;
}

export interface IExtensionRequirement {
  id: string;
  version?: string;
  optional?: boolean;
  incompatible?: boolean;
  suggest?: boolean;
}