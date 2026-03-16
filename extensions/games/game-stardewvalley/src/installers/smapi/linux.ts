import type { ISMAPIPlatformVariant } from './types';

/** Linux SMAPI archive/executable metadata. */
export const linuxSMAPIPlatform: ISMAPIPlatformVariant = {
  id: 'linux',
  executableName: 'StardewModdingAPI',
  archiveFolder: 'linux',
  dataFiles: [
    'linux-install.dat',
    'install.dat',
  ],
  implemented: true,
};
