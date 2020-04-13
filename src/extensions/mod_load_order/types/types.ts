import * as Promise from 'bluebird';
import { types } from 'vortex-api';

export type SortType = 'ascending' | 'descending';

// A set of props forwarded to game extensions which
//  will allow these to control certain aspects of the
//  load order extension from within the info panel.
export interface IInfoPanelProps {
  // Will force the load order page to re-render.
  refresh: () => void;
}

export interface ILoadOrderEntry {
  // The position/index/priority for this entry.
  pos: number;

  // Is this entry enabled ?
  enabled: boolean;

  // If the load order entry is locked to its current position/index/priority.
  locked?: boolean;

  // Externally managed or manually managed mods have been added externally
  //  by the user or a 3rd party application and has been detected by Vortex.
  external?: boolean;
}

export interface ILoadOrder {
  [modId: string]: ILoadOrderEntry;
}

export interface IDnDConditionResult {
  // Dictates whether the DnD action can be performed.
  success: boolean;

  // Why has the DnD condition failed ? This will be
  //  displayed on the Load Order screen to the user.
  errMessage?: string;
}

export interface ILoadOrderDisplayItem {
  // mod Id as stored in Vortex
  id: string;

  // mod display name.
  name: string;

  // the url pointing to the mod's display image.
  imgUrl: string;

  // Some game mod patterns require a prefix to be set.
  //  (e.g. 7dtd, etc)
  prefix?: string;

  // Is this mod locked - locked mods are not draggable.
  locked?: boolean;

  // Is this mod externally sourced (manually added, or 3rd party app)
  external?: boolean;

  // Is this mod invalid - the 'message' paramater can be used to
  //  specify what went wrong.
  invalid?: boolean;

  // An optional message which can be displayed beneath the mod's
  //  image.
  message?: string;

  // Allow game extensions to provide a condition functor
  //  during the preSort function call. This is useful if
  //  the game extension wants to impose some DnD restrictions
  //  e.g. Disallow ESP's or ESL's from being positioned above an ESM
  condition?: (lhs: ILoadOrderDisplayItem,
               rhs: ILoadOrderDisplayItem) => IDnDConditionResult;
}

export interface IGameLoadOrderEntry {
  // The domain gameId for this entry.
  gameId: string;

  // The path to the game extension's default image.
  gameArtURL: string;

  // Provides game extensions with relevant props that the extension writer
  //  can use to build the information panel. Providing a string here instead
  //  of a react component will create a default component instead.
  createInfoPanel: (props: IInfoPanelProps) => string | React.Component;

  // Give the game extension the opportunity to modify the load order
  //  before we start sorting the mods.
  preSort?: (items: ILoadOrderDisplayItem[],
             sortDir: SortType) => Promise<ILoadOrderDisplayItem[]>;

  // Allow game extensions to run custom filtering logic
  //  and display only mods which need to be sorted.
  filter?: (mods: types.IMod[]) => types.IMod[];

  // Allow game extensions to react whenever the load order
  //  changes.
  callback?: (loadOrder: ILoadOrder) => void;

  // Add option to provide a custom item renderer if wanted.
  //  Default item renderer will be used if left undefined.
  itemRenderer?: React.ComponentClass<{
    className?: string;
    item: ILoadOrderDisplayItem;
    onRef: (ref: any) => any;
  }>;
}
