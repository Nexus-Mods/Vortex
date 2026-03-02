import { setModAttribute } from "../../actions";
import type {
  IExtensionApi,
  IMod,
  IState,
  ITableAttribute,
} from "../../types/api";
import { laterT } from "../../util/i18n";
import {
  activeGameId,
  currentGame,
  downloadPathForGame,
  gameById,
  knownGames,
} from "../../util/selectors";
import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";
import type { IModWithState } from "../mod_management/types/IModProps";
import NXMUrl from "./NXMUrl";
import { nexusGames } from "./util";
import { checkModVersion } from "./util/checkModsVersion";
import { convertGameIdReverse, nexusGameId } from "./util/convertGameId";
import EndorsementFilter from "./views/EndorsementFilter";
import EndorseModButton from "./views/EndorseModButton";
import NexusModIdDetail from "./views/NexusModIdDetail";

import type Nexus from "@nexusmods/nexus-api";
import type { TFunction } from "i18next";
import * as React from "react";
import { useSelector } from "react-redux";
import type * as Redux from "redux";
import { fillNexusIdByMD5, queryResetSource } from "./util/guessModID";

interface INexusIdProps {
  api: IExtensionApi;
  nexus: () => Nexus;
  mod: IModWithState;
  t: TFunction;
}

// TODO: the field names in this object will be shown to the user, hence the capitalization
function NexusId(props: INexusIdProps) {
  const { api, nexus, mod, t } = props;

  const fileName: string = mod.attributes?.fileName ?? mod.attributes?.name;

  const gameMode = useSelector(activeGameId);

  const fileGameId = mod.attributes?.downloadGame || gameMode;

  const downloadPath = useSelector((state: IState) =>
    downloadPathForGame(state, fileGameId),
  );
  const downloads = useSelector(
    (state: IState) => state.persistent.downloads.files ?? {},
  );

  const hasArchive =
    mod.archiveId !== undefined && downloads[mod.archiveId] !== undefined;

  const updateByMD5 = React.useCallback(() => {
    fillNexusIdByMD5(
      api,
      gameMode,
      mod,
      fileName,
      downloadPath,
      hasArchive,
    ).catch((err) => {
      api.showErrorNotification("Query failed", err, { allowReport: false });
    });
  }, [mod]);

  const openURL = React.useCallback(() => {
    api.events.emit(
      "open-mod-page",
      fileGameId,
      mod.attributes?.modId,
      mod.attributes.source,
    );
  }, []);

  const checkForUpdate = React.useCallback(() => {
    checkModVersion(api.store, nexus(), fileGameId, mod).catch((err) => {
      if (err.statusCode === 403) {
        return queryResetSource(api, fileGameId, mod);
      } else {
        api.showErrorNotification("Query failed", err, { allowReport: false });
      }
    });
  }, [fileGameId, mod]);

  return (
    <NexusModIdDetail
      t={t}
      modId={mod.id}
      nexusModId={mod.attributes?.modId?.toString()}
      nexusFileId={mod.attributes?.fileId?.toString()}
      fileHash={mod.attributes?.fileMD5}
      archiveId={hasArchive ? mod.archiveId : undefined}
      activeGameId={gameMode}
      fileName={fileName}
      isDownload={mod.state === "downloaded"}
      store={api.store}
      onOpenURL={openURL}
      onUpdateByMD5={updateByMD5}
      onCheckForUpdate={checkForUpdate}
    />
  );
}

export type EndorseMod = (
  gameId: string,
  modId: string,
  endorsedStatus: string,
) => void;
export type TrackMod = (gameId: string, modId: string, track: boolean) => void;
const noOp = () => null;
function createEndorsedIcon(
  store: Redux.Store<any>,
  mod: IMod,
  onEndorse: EndorseMod,
  t: TFunction,
) {
  const nexusModId: string =
    mod.attributes?.modId?.toString() ??
    mod.attributes?.collectionId?.toString();
  const version: string = mod.attributes?.version;
  const state: string = getSafe(mod, ["state"], undefined);

  // TODO: this is not a reliable way to determine if the mod is from nexus
  const isNexusMod: boolean =
    nexusModId !== undefined &&
    version !== undefined &&
    !isNaN(parseInt(nexusModId, 10));

  let endorsed: string = mod.attributes?.endorsed;
  if (endorsed === undefined && state === "downloaded") {
    // The mod is sourced from nexus but is not installed, which means
    //  we can't endorse the mod anyway and therefore should just hide the endorse button.
    return null;
  }

  const allowRating: boolean = getSafe(mod.attributes, ["allowRating"], true);
  if (!allowRating) {
    endorsed = "Disabled";
  }

  if (
    (endorsed === undefined && state === "installing") ||
    (endorsed === undefined && isNexusMod)
  ) {
    endorsed = "Undecided";
  }

  if (
    getSafe(mod.attributes, ["author"], undefined) ===
    getSafe(
      store.getState(),
      ["persistent", "nexus", "userInfo", "name"],
      undefined,
    )
  ) {
    endorsed = undefined;
  }

  let endorseFunc = onEndorse;
  if (mod.attributes?.collectionId) {
    const collectionInfo =
      store.getState().persistent.collections?.collections?.[
        mod.attributes.collectionId
      ]?.info;
    endorsed = collectionInfo?.viewerIsBlocked ? "Blocked" : endorsed;
    endorseFunc = noOp;
  }

  const gameId =
    getSafe(mod.attributes, ["downloadGame"], undefined) ||
    activeGameId(store.getState());
  if (endorsed !== undefined) {
    return (
      <EndorseModButton
        endorsedStatus={endorsed}
        t={t}
        gameId={gameId}
        modId={mod.id}
        onEndorseMod={endorseFunc}
      />
    );
  }

  return null;
}

export function genEndorsedAttribute(
  api: IExtensionApi,
  onEndorseMod: EndorseMod,
): ITableAttribute {
  return {
    id: "endorsed",
    name: laterT("Endorsed"),
    description: laterT("Endorsement state on Nexus"),
    icon: "star",
    customRenderer: (mod: IMod, detail: boolean, t: TFunction) =>
      getSafe(mod.attributes, ["source"], undefined) === "nexus"
        ? createEndorsedIcon(api.store, mod, onEndorseMod, t)
        : null,
    calc: (mod: IMod) =>
      getSafe(mod.attributes, ["source"], undefined) === "nexus"
        ? getSafe(mod.attributes, ["endorsed"], null)
        : undefined,
    placement: "table",
    isToggleable: true,
    edit: {},
    isSortable: true,
    filter: new EndorsementFilter(),
  };
}

export function genModIdAttribute(
  api: IExtensionApi,
  nexus: () => Nexus,
): ITableAttribute<IModWithState> {
  return {
    id: "nexusModId",
    name: laterT("Nexus Mods IDs"),
    description: laterT("Internal ID used by www.nexusmods.com"),
    icon: "external-link",
    customRenderer: (mod: IModWithState, detail: boolean, t: TFunction) => {
      const res =
        mod.attributes?.source === "nexus" && mod.type !== "collection" ? (
          <NexusId t={t} api={api} nexus={nexus} mod={mod} />
        ) : null;
      return res;
    },
    calc: (mod: IMod) =>
      mod.attributes?.source === "nexus" && mod.type !== "collection"
        ? (mod.attributes?.modId ?? null)
        : undefined,
    placement: "detail",
    isToggleable: false,
    edit: {},
    isSortable: false,
    isVolatile: true,
  };
}

export function genCollectionIdAttribute(
  api: IExtensionApi,
  nexus: () => Nexus,
): ITableAttribute {
  return {
    id: "nexusCollectionId",
    name: laterT("Nexus Collection ID"),
    description: laterT("Internal ID used by www.nexusmods.com"),
    icon: "external-link",
    customRenderer: (mod: IModWithState, detail: boolean, t: TFunction) => {
      const res =
        mod.attributes?.source === "nexus" && mod.type === "collection" ? (
          <p>{mod.attributes?.collectionId ?? t("Not published")}</p>
        ) : null;
      return res;
    },
    calc: (mod: IMod) =>
      (mod.attributes?.source ?? "nexus") && mod.type === "collection"
        ? (mod.attributes?.collectionId ?? null)
        : undefined,
    placement: "detail",
    isToggleable: false,
    edit: {},
    isSortable: false,
    isVolatile: true,
  };
}

export function genGameAttribute(api: IExtensionApi): ITableAttribute<IMod> {
  return {
    id: "downloadGame",
    name: laterT("Game Section"),
    description: laterT("NexusMods Game Section"),
    calc: (mod) => {
      if (getSafe(mod.attributes, ["source"], undefined) !== "nexus") {
        return undefined;
      }
      let downloadGame: string | string[] = getSafe(
        mod.attributes,
        ["downloadGame"],
        undefined,
      );
      if (Array.isArray(downloadGame)) {
        downloadGame = downloadGame[0];
      }
      const game =
        downloadGame !== undefined
          ? gameById(api.store.getState(), downloadGame)
          : currentGame(api.store.getState());
      const nexusId = nexusGameId(game) || downloadGame;
      const gameEntry = nexusGames().find(
        (iter) => iter.domain_name === nexusId,
      );
      return gameEntry !== undefined ? gameEntry.name : nexusId;
    },
    placement: "detail",
    help: api.laterT(
      "If you've downloaded this mod from a different game section than you're managing, " +
        "set this to the game the mod was intended for.\n\n" +
        "So if you manually downloaded this mod from the Skyrim section and installed it for " +
        'Skyrim Special Edition, set this to "Skyrim".\n\n' +
        "Otherwise, please don't change this. It is required to be correct so " +
        "Vortex can retrieve the correct mod information (including update info).",
    ),
    edit: {
      readOnly: (mod: IModWithState) => mod.state === "downloaded",
      choices: () =>
        nexusGames()
          .sort()
          .map((game) => ({ key: game.domain_name, text: game.name })),
      onChangeValue: (mods, value) => {
        const gameMode = activeGameId(api.store.getState());
        if (!Array.isArray(mods)) {
          mods = [mods];
        }
        mods.forEach((mod) => {
          api.store.dispatch(
            setModAttribute(
              gameMode,
              mod.id,
              "downloadGame",
              convertGameIdReverse(knownGames(api.store.getState()), value),
            ),
          );
        });
      },
    },
  };
}
