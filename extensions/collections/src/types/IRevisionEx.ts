import { IRevision } from "@nexusmods/nexus-api";

export interface IRevisionEx extends IRevision {
  success?: boolean;
}
