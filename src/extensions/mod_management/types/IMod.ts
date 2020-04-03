import { IReference, IRule } from 'modmeta-db';

export { IReference, IRule };

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
  // mod type (empty string is the default)
  // this type is primarily used to determine how and where to deploy the mod, it
  // could be "enb" for example to tell vortex the mod needs to be installed to the game
  // directory. Different games will have different types
  type: string;
  // id of the corresponding download
  archiveId?: string;
  // path to the installed mod (will usually be the same as id)
  installationPath: string;
  // dictionary of extended information fields
  attributes?: { [id: string]: any };
  // list of custom rules for this mod instance
  rules?: IModRule[];
  // list of enabled ini tweaks
  enabledINITweaks?: string[];
  // list of files that shall always be provided by this mod, no matter the deployment order
  fileOverrides?: string[];
}

// identifies a mod in an online repository (like nexusmods.com)
// we're assuming there will be at least an id for the file.
// if the fileid is not unique across all mods we require an id to identify the mod.
// if the modid is not unique across all games, we require an id to identify the game as well.
export interface IModRepoId {
  gameId?: string;
  modId?: string;
  fileId: string;
}

export interface IModReference extends IReference {
  id?: string;
  // using a set of ids identifying the mod on a specific repository
  repo?: { repository: string } & IModRepoId;
  // optional parameter used to display the reference in a user-friendly way if available.
  // This is only used when the mod isn't installed, otherwise we always try to use the name
  // the user chose for the mod.
  description?: string;
  tag?: string;
}

/**
 * a mod (requires/recommends) rule can provide a list of files to control how the referenced
 * mod is to be installed if it gets installed as a dependency.
 *
 * At this time Vortex does not verify that an already-installed mod contains these files
 */
export interface IFileListItem {
  path: string;
  md5: string;
}

export interface IDownloadHint {
  mode: 'direct' | 'browse' | 'manual';
  url?: string;
  instructions?: string;
}

export interface IModRule extends IRule {
  reference: IModReference;
  fileList?: IFileListItem[];
  // the format of these choices is installer-specific
  installerChoices?: any;
  downloadHint?: IDownloadHint;
  // additional information attached to the rule. This will not have
  // any effect on the resolution of the rule but may be used to
  // customize/improve its presentation or used to add details to a mod
  // after/if it got installed through this rule.
  extra?: { [key: string]: any };
}
