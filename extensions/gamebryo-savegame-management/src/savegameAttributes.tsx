import { updateSavegame } from "./actions/session";
import { ISavegame } from "./types/ISavegame";
import CharacterFilter from "./util/CharacterFilter";
import { getScreenshot, loadSaveGame } from "./util/refreshSavegames";
import PluginList from "./views/PluginList";
import ScreenshotCanvas from "./views/ScreenshotCanvas";

import * as React from "react";
import {
  TableDateTimeFilter,
  TableNumericFilter,
  TableTextFilter,
  types,
  util,
} from "vortex-api";

let language: string;
let collator: Intl.Collator;

type SavegameType = "auto" | "quick" | "exit" | "manual";

function saveType(savegame: ISavegame): SavegameType {
  const fileNameL = (savegame.attributes["filename"] ?? "").toLowerCase();
  if (fileNameL.startsWith("autosave")) {
    return "auto";
  } else if (fileNameL.startsWith("quicksave")) {
    return "quick";
  } else if (fileNameL.startsWith("exitsave")) {
    return "exit";
  } else {
    return "manual";
  }
}

const typeToString = (() => {
  const toString = {
    auto: (t: types.TFunction) => t("Autosave"),
    quick: (t: types.TFunction) => t("Quicksave"),
    exit: (t: types.TFunction) => t("Exitsave"),
  };

  return (t: types.TFunction, type: SavegameType): string =>
    toString[type]?.(t) ?? t("Manual save");
})();

function getSavegameAttributes(
  api: types.IExtensionApi,
  addScreenshotAttrib: boolean,
  sgList: () => { [saveId: string]: ISavegame },
  getInstalledPlugins: () => Promise<string[]>,
): types.ITableAttribute[] {
  const loading: Set<string> = new Set();
  const screenshotAttribute: types.ITableAttribute = {
    id: "screenshot",
    name: "Screenshot",
    description: "Savegame screenshot",
    icon: " file-picture-o",
    customRenderer: (savegame: ISavegame) => {
      // customRenderer will only be called when the screenshot actually comes into view so
      // we use it as a trigger to get more detailed info from the file
      if (
        savegame.attributes.screenshot === undefined ||
        getScreenshot(savegame.id) === undefined
      ) {
        if (
          !loading.has(savegame.id) &&
          savegame.attributes["corrupted"] !== true
        ) {
          loading.add(savegame.id);
          loadSaveGame(
            savegame.filePath,
            savegame.fileSize,
            (save: ISavegame) => {
              api.store.dispatch(updateSavegame(save.id, save));
            },
            true,
          )
            .then(() => {
              loading.delete(savegame.id);
            })
            .catch((err) => {
              loading.delete(savegame.id);
              if (err.path === undefined && typeof err !== "string") {
                err.path = savegame.filePath;
              }
              api.showErrorNotification("Failed to load screenshot", err, {
                allowReport: false,
                message: savegame.filePath,
                attachments: [
                  {
                    id: "savegame",
                    type: "file",
                    data: savegame.filePath,
                    description: "The broken savegame",
                  },
                ],
              });
            });
        }
        return null;
      } else {
        return <ScreenshotCanvas save={savegame} />;
      }
    },
    calc: (savegame: ISavegame) => savegame.attributes["screenshot"],
    placement: "both",
    isToggleable: true,
    edit: {},
  };

  const attributes: types.ITableAttribute[] = [
    {
      id: "id",
      name: "Save Game ID",
      description: "Id of the savegame",
      icon: "id-badge",
      calc: (savegame: ISavegame) => savegame.attributes["id"],
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isDefaultVisible: false,
      edit: {},
    },
    {
      id: "name",
      name: "Character Name",
      description: "Name of the character",
      icon: "quote-left",
      calc: (savegame: ISavegame) => savegame.attributes["name"],
      placement: "both",
      isDefaultFilter: true,
      isToggleable: true,
      isSortable: true,
      isGroupable: true,
      filter: new CharacterFilter(sgList),
      edit: {},
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        if (collator === undefined || locale !== language) {
          language = locale;
          collator = new Intl.Collator(locale, { sensitivity: "base" });
        }
        return collator.compare(lhs, rhs);
      },
    } as any,
    {
      id: "level",
      name: "Character Level",
      description: "Level of the character",
      icon: "level-up",
      calc: (savegame: ISavegame) => savegame.attributes["level"],
      placement: "both",
      isToggleable: true,
      isSortable: true,
      filter: new TableNumericFilter(),
      sortFunc: (lhs: number, rhs: number): number => lhs - rhs,
      edit: {},
    },
    {
      id: "location",
      name: "Ingame Location",
      description: "Location during the save",
      icon: "map-marker",
      calc: (savegame: ISavegame) => savegame.attributes["location"],
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isGroupable: true,
      filter: new TableTextFilter(true),
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        if (collator === undefined || locale !== language) {
          language = locale;
          collator = new Intl.Collator(locale, { sensitivity: "base" });
        }
        return collator.compare(lhs, rhs);
      },
      edit: {},
    } as any,
    {
      id: "filename",
      name: "Filename",
      description: "Name of the file",
      icon: "file-picture-o",
      calc: (savegame: ISavegame) => savegame.attributes["filename"],
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isDefaultVisible: false,
      filter: new TableTextFilter(true),
      edit: {},
    },
    {
      id: "filesize",
      name: "Filesize",
      description: "Size of the file",
      icon: "file-picture-o",
      calc: (savegame: ISavegame) => savegame.fileSize,
      customRenderer: (savegame: ISavegame) => (
        <>{util.bytesToString(savegame.fileSize)}</>
      ),
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isDefaultVisible: false,
      filter: new TableTextFilter(true),
      edit: {},
    },
    {
      id: "creationtime",
      name: "Creation Time",
      description: "File creation time",
      icon: "calendar-plus-o",
      customRenderer: (savegame: ISavegame, detail: boolean, t) => {
        if (detail) {
          const lang = util.getCurrentLanguage();
          return (
            <p>
              {new Date(savegame.attributes["creationtime"]).toLocaleString(
                lang,
              )}
            </p>
          );
        } else {
          const creationTime = new Date(savegame.attributes["creationtime"]);
          const prettyTime =
            (util as any).userFriendlyTime !== undefined
              ? (util as any).userFriendlyTime(creationTime, t, api.locale())
              : util.relativeTime(creationTime, t);
          return <p>{prettyTime}</p>;
        }
      },
      calc: (savegame: ISavegame) =>
        new Date(savegame.attributes["creationtime"]),
      placement: "both",
      isToggleable: true,
      isSortable: true,
      filter: new TableDateTimeFilter(),
      edit: {},
    },
    {
      id: "savetype",
      name: "Savegame Type",
      description: "Whether this save is a autosave/quicksave or manual one",
      calc: (savegame: ISavegame, t: types.TFunction) =>
        typeToString(t, saveType(savegame)),
      placement: "both",
      isToggleable: true,
      isSortable: true,
      isDefaultSort: false,
      isDefaultVisible: false,
      isGroupable: true,
      edit: {},
    },
    {
      id: "playtime",
      name: "Play Time",
      description: "Amount of time that expired in-game",
      icon: "calendar-plus-o",
      calc: (savegame: ISavegame) => savegame.attributes["playTime"],
      placement: "both",
      isToggleable: true,
      isDefaultVisible: false,
      isSortable: true,
      edit: {},
    },
    {
      id: "plugins",
      name: "Plugins",
      description: "Savegame plugins",
      icon: "file-picture-o",
      customRenderer: (savegame: ISavegame) => (
        <PluginList
          plugins={savegame.attributes["plugins"]}
          getInstalledPlugins={getInstalledPlugins}
        />
      ),
      calc: (savegame: ISavegame) => savegame.attributes["plugins"],
      placement: "detail",
      isToggleable: false,
      edit: {},
    },
  ];

  if (addScreenshotAttrib) {
    attributes.unshift(screenshotAttribute);
  }

  return attributes;
}

export default getSavegameAttributes;
