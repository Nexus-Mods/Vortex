import type { IExtensionApi } from "../../../types/IExtensionContext";
import { PluginFileConflict } from "./PluginPersistor";

/** What the keep/revert question says, for each reason the persistor asks it. */
const DIALOG: Record<PluginFileConflict, { title: string; text: string }> = {
  [PluginFileConflict.ForeignChange]: {
    title: "Plugin list changed outside Vortex",
    text:
      "Another tool or the game changed the plugin list files. " +
      "Keep those changes or revert to the load order Vortex manages?",
  },
  [PluginFileConflict.Unreadable]: {
    title: "Plugin list could not be read",
    text:
      "Vortex could not read your plugin list files, so it does not know your current load " +
      "order. Keep the files as they are, or overwrite them with what Vortex has? " +
      "Overwriting will disable the plugins it never managed to read.",
  },
};

/** Tells the user their load order was rebuilt after plugins.txt turned up empty. */
export function makeEmptyListNotice(api: IExtensionApi): () => void {
  return () => {
    api.sendNotification({
      id: "plugin-list-recovered",
      type: "warning",
      title: "Plugin list was empty",
      message:
        "Your plugin list file was empty. Vortex restored the load order, but could not tell " +
        "which plugins were enabled, so they are all disabled. Please enable them again.",
    });
  };
}

/** Asks whether to keep the plugin files on disk or the load order Vortex holds. */
export function makePluginConflictPrompt(
  api: IExtensionApi,
): (reason: PluginFileConflict) => PromiseLike<"keep" | "revert"> {
  return (reason) => {
    const { title, text } = DIALOG[reason];
    return api
      .showDialog("question", title, { text }, [{ label: "Revert" }, { label: "Keep" }])
      .then((result) => (result.action === "Keep" ? "keep" : "revert"));
  };
}
