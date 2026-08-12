import { createAction } from "redux-act";

import type { IExtensionOptional } from "../../types/api";
import type { IAvailableExtension } from "../../types/extensions";

export const setAvailableExtensions = createAction(
  "SET_AVAILABLE_EXTENSIONS",
  (extensions: IAvailableExtension[]) => extensions,
);

export const setExtensionsUpdate = createAction(
  "SET_EXTENSIONS_UPDATE_TIME",
  (time: number) => time,
);

export const setOptionalExtensions = createAction(
  "SET_OPTIONAL_EXTENSIONS",
  (optional: { [extensionName: string]: IExtensionOptional[] }) => optional,
);
