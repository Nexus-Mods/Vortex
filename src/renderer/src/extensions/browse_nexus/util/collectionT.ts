import type { IExtensionApi } from "@/types/IExtensionContext";

/** Translates in the collection namespace, as the collections browser always has. */
export const collectionT =
  (api: IExtensionApi) => (input: string, options?: Record<string, unknown>) =>
    api.translate(input, {
      isNamespaceKey: true,
      ns: ["collection", "common"],
      ...options,
    });
