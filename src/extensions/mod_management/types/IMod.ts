export type ModState =
  'downloading' | 'downloaded' | 'installing' | 'installed';

/**
 * represents a mod in all states (being downloaded, downloaded, installed)
 * 
 * @interface IMod
 */
export interface IMod {
  id: string;

  state: ModState;

  // path to the installation archive (relative to install dir)
  archivePath?: string;
  // path to the installed mod
  installationPath?: string;
  // dictionary of extended information fields
  attributes: { [id: string]: any };
}
