/**
 * Screenshot check extension
 * Provides a means to browse screenshots and videos captured while playing
 */

import { mdiFolderMultipleImage } from "@mdi/js";

import type { IExtensionContext } from "@/types/IExtensionContext";

import { activeGameId } from "../../util/selectors";
import { persistentReducer } from "./reducers/persistent";
import { sessionReducer } from "./reducers/session";
import MediaPage from "./views/MediaPage";
import SettingsMedia from "./views/SettingsMedia";

function init(context: IExtensionContext) {
  context.registerReducer(["persistent", "game_media"], persistentReducer);
  context.registerReducer(["session", "game_media"], sessionReducer);

  context.registerMainPage("highlight-ui", "Media", MediaPage, {
    priority: 70,
    hotkey: "I",
    group: "per-game",
    newLayout: true,
    visible: () => activeGameId(context.api.getState()) !== undefined,
    isModernOnly: true,
    mdi: mdiFolderMultipleImage,
    props: () => ({
      api: context.api,
    }),
  });

  context.registerSettings(
    "Media",
    SettingsMedia,
    () => ({
      api: context.api,
    }),
    () => activeGameId(context.api.getState()) !== undefined,
    80,
  );

  return true;
}

export default init;
