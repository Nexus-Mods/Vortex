import { ICollection } from "@nexusmods/nexus-api";
import { IRevisionEx } from "./IRevisionEx";

export interface ICollectionEx extends ICollection {
  revisions: IRevisionEx[];
}
