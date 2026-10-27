/** The key paths are matched by: letter case never tells paths apart, as on Windows. */
export const pathKeyOf = (path: string): string => path.toUpperCase();

/** The key every path inside a folder starts with. */
export const folderKeyOf = (folder: string): string =>
  pathKeyOf(folder.endsWith("/") ? folder : `${folder}/`);
