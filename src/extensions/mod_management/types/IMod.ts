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

  // id of the corresponding download
  archiveId?: string;
  // path to the installed mod
  installationPath?: string;
  // dictionary of extended information fields
  attributes: { [id: string]: any };
}
