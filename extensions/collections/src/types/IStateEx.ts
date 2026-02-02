import { ICollection, IRevision } from "@nexusmods/nexus-api";
import { types } from "vortex-api";

const dummy: types.IState = undefined;

export type ISession = typeof dummy.session;
export type IPersistent = typeof dummy.persistent;

export interface IStateEx extends types.IState {
  session: typeof dummy.session & {
    collections: {
      modId: string;
    };
  };
  persistent: typeof dummy.persistent & {
    collections: {
      collections: {
        [collectionId: string]: {
          timestamp: number;
          info: ICollection;
        };
      };
      revisions: {
        [revisionId: number]: {
          timestamp: number;
          info: IRevision;
        };
      };
    };
  };
}
