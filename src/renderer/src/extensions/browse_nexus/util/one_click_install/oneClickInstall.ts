/** The key of a mod's 1-click install, which outlasts its download until its install is done. */
export const oneClickInstallKey = (modId: string) => ["browse", "install", modId];

/**
 * The key of the 1-click installs of a mod's files from the picker's cards, which the details'
 * button and status wait on as on the mod's own.
 */
export const oneClickFileInstallsKey = (modId: string) => ["browse", "install-file", modId];

/**
 * The key of the 1-click install of one file of a mod. Not under the mod's own key, so each card
 * shows only its own install.
 */
export const oneClickFileInstallKey = ({ modId, fileId }: { modId: string; fileId: number }) => [
  ...oneClickFileInstallsKey(modId),
  fileId,
];
