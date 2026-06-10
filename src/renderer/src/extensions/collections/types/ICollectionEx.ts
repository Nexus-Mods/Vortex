import type { ICollection } from "@nexusmods/nexus-api";

import type { IRevisionEx } from "./IRevisionEx";

export interface ICollectionEx extends ICollection {
  revisions: IRevisionEx[];
}
