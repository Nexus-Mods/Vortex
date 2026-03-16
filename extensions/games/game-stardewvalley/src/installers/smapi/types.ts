/**
 * Platform-specific SMAPI installer metadata.
 */
export type SMAPIPlatformId = 'windows' | 'linux' | 'macos';

/**
 * Defines archive/executable behaviour for one SMAPI installer platform.
 */
export interface ISMAPIPlatformVariant {
  id: SMAPIPlatformId;
  executableName: string;
  archiveFolder: string;
  dataFiles: string[];
  implemented: boolean;
  unsupportedReason?: string;
}
