import type { IRevision } from "@nexusmods/nexus-api";

import type * as types from "../../../types/api";

export interface IExtendedInterfaceProps {
  t: types.TFunction;
  gameId: string;
  collection: types.IMod;
  revisionInfo: IRevision;
  onSetCollectionAttribute: (attrPath: string[], value: any) => void;
}
