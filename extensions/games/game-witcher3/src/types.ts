import { IncomingHttpHeaders } from 'http';
import { types } from 'vortex-api';

export type PrefixType = 'dlc' | 'mod';

export interface IDeployment { [modTypeId: string]: IDeployedFile[]; }
export interface IDeployedFile {
  relPath: string;
  source: string;
  merged?: string[];
  target?: string;
  time: number;
}

export interface IRemoveModOptions {
  willBeReplaced?: boolean;
  incomplete?: boolean;
  ignoreInstalling?: boolean;
  modData?: types.IMod;
  progressCB?: (numRemoved: number, numTotal: number, name: string) => void;
}

export interface IItemRendererProps {
  // The actual item we want to render.
  loEntry: types.ILoadOrderEntry;

  // Tells the item renderer whether to display checkboxes or not.
  displayCheckboxes: boolean;

  // Used to display a small tooltip icon next to the invalid mod entry
  //  describing the issue directly on the mod entry in the LO page.
  invalidEntries?: any[];

  // Function components cannot be given refs, which means that DnD
  //  will not work when using the Vortex API's DraggableItem without
  //  forwarding the ref to the itemRenderer.
  setRef?: (ref: any) => void;
}

export interface IIncomingGithubHttpHeaders extends IncomingHttpHeaders {
  "x-ratelimit-reset": string;
  "x-ratelimit-remaining": string;
}