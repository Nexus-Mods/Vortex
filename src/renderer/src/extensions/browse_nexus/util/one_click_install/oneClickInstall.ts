/** The key of a mod's 1-click install, which outlasts its download until its install is done. */
export const oneClickInstallKey = (modId: string) => ["browse", "install", modId];

/**
 * The key of the 1-click install of one file of a mod. Not under the mod's own key, so the
 * details' button doesn't show a card's install.
 */
export const oneClickFileInstallKey = ({ modId, fileId }: { modId: string; fileId: number }) => [
  "browse",
  "install-file",
  modId,
  fileId,
];
