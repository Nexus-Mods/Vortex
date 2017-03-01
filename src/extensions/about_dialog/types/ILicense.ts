export interface ILicense {
  key?: string;
  name: string;
  version: string;
  description: string;
  licenses: string | string[];
  repository: string;
  publisher: string;
  email?: string;
  url?: string;
  licenseFile?: string;
  licenseModified?: 'yes' | 'no';
}
