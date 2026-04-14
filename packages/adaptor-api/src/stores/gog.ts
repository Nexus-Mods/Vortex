import type { StoreBase, StorePathProviderBase } from "./providers";

export type GOGBase = StoreBase;

export interface GOGPathProvider extends StorePathProviderBase<GOGBase, "gog"> {
  readonly scheme: "gog";
}
