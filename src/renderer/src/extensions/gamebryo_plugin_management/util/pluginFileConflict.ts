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
