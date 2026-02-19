import { IRevision } from "@nexusmods/nexus-api";
import { types } from "vortex-api";

export interface IExtendedInterfaceProps {
  t: types.TFunction;
  gameId: string;
  collection: types.IMod;
  revisionInfo: IRevision;
  onSetCollectionAttribute: (attrPath: string[], value: any) => void;
}
