import { IRule } from 'modmeta-db';

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
  // list of custom rules for this mod instance
  rules?: IRule[];
  // list of enabled ini tweaks
  enabledINITweaks?: string[];
}
