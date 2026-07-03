import type { IRevision } from "@nexusmods/nexus-api";

import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { TFunction } from "../../../util/i18n";

export interface IExtendedInterfaceProps {
  t: TFunction;
  gameId: string;
  collection: IMod;
  revisionInfo: IRevision;
  onSetCollectionAttribute: (attrPath: string[], value: any) => void;
}
