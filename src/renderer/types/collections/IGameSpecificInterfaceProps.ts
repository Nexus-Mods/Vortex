import type { IRevision } from "@nexusmods/nexus-api";
import type * as types from "../api";

export interface IGameSpecificInterfaceProps {
  t: types.TFunction;
  collection: types.IMod;
  revisionInfo: IRevision;
}
