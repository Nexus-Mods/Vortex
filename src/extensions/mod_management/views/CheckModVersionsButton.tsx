import { ButtonType } from "../../../renderer/controls/IconBar";
import ToolbarIcon from "../../../renderer/controls/ToolbarIcon";
import {
  ComponentEx,
  connect,
  translate,
} from "../../../renderer/controls/ComponentEx";
import { activeGameId, activeProfile } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";

import { IProfile, IProfileMod } from "../../profile_management/types/IProfile";

import { IMod } from "../types/IMod";

import _ from "lodash";

import * as React from "react";
import updateState from "../util/modUpdateState";

export type IModWithState = IMod & IProfileMod;

export interface IBaseProps {
  instanceId?: string | string[];
  buttonType: ButtonType;
  selectionOnly?: boolean;
}

interface IConnectedProps {
  mods: { [modId: string]: IModWithState };
  gameMode: string;
  updateRunning: boolean;
  isPremium: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class CheckVersionsButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, updateRunning } = this.props;

    if (updateRunning) {
      return (
        <ToolbarIcon
          id="check-mods-version"
          icon="spinner_new"
          text={t("Checking for mod updates")}
          disabled={true}
          spin
        />
      );
    } else {
      const id = "check-mod-updates-button";
      return (
        <ToolbarIcon
          id={id}
          icon="refresh"
          text={t("Check for Updates")}
          onClick={this.checkForUpdatesAndInstall}
        />
      );
    }
  }

  private raiseUpdateAllNotification = (modIds: string[]) => {
    const message =
      modIds.length === 0
        ? "All mods up to date"
        : `${modIds.length} mod update${modIds.length === 1 ? "" : "s"} available`;

    this.context.api.sendNotification({
      id: "check-mods-version-complete",
      type: "success",
      message: message,
      actions:
        this.props.isPremium && modIds.length > 0
          ? [
              {
                title: "Update All",
                action: (dismiss) => {
                  dismiss();
                  this.updateAll(modIds);
                },
              },
            ]
          : undefined,
      displayMS: modIds.length === 0 ? 5000 : undefined,
    });
  };

  private dispatchCheckModsVersionEvent = async (
    force: boolean,
  ): Promise<string[]> => {
    const { gameMode } = this.props;
    try {
      const mods = this.props.selectionOnly
        ? typeof this.props.instanceId === "string"
          ? [this.props.instanceId]
          : this.props.instanceId
        : Object.keys(this.props.mods);
      const modIdsResults: string[][] = await this.context.api.emitAndAwait(
        "check-mods-version",
        gameMode,
        _.pick(this.props.mods, mods),
        force,
      );
      const modIds = modIdsResults
        .filter((iter) => iter !== undefined)
        .reduce((prev: string[], iter: string[]) => [...prev, ...iter], []);
      return Promise.resolve(modIds);
    } catch (error) {
      this.context.api.showErrorNotification(
        "Error checking for mod updates",
        error,
      );
      return Promise.resolve([]);
    }
  };

  private checkForUpdatesAndInstall = () => {
    return this.dispatchCheckModsVersionEvent(true)
      .then(() => {
        const mods = this.props.selectionOnly
          ? typeof this.props.instanceId === "string"
            ? [this.props.instanceId]
            : this.props.instanceId
          : Object.keys(this.props.mods);
        const outdatedModIds = mods.filter((modId) => {
          const mod = this.props.mods[modId];
          if (mod?.attributes == null) {
            return false;
          }
          const state = updateState(mod.attributes);
          return state === "update" && mod.type !== "collection" && mod.enabled;
        });
        return Array.from(new Set<string>([].concat(outdatedModIds)));
      })
      .then((modIds: string[]) => {
        this.raiseUpdateAllNotification(modIds);
      });
  };

  private updateAll = (modIds: string[]) => {
    const { gameMode } = this.props;
    const updateAble = modIds.filter((modId) => {
      const mod = this.props.mods[modId];
      if (mod?.attributes == null) {
        return false;
      }
      const state = updateState(mod.attributes);
      return state === "update" && mod.type !== "collection";
    });
    if (updateAble.length < modIds.length) {
      this.context.api.sendNotification({
        id: "check-mods-version-partial",
        type: "info",
        message: "Some mods could not be updated automatically.",
      });
    }
    if (updateAble.length > 0) {
      this.context.api.events.emit("mods-update", gameMode, updateAble);
    }
  };
}

const emptyObject = {};

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  const profile = activeProfile(state);
  const modsWithState: { [modId: string]: IModWithState } = {};
  const mods: { [modId: string]: IMod } = getSafe(
    state,
    ["persistent", "mods", gameMode],
    emptyObject,
  );
  if (profile && profile.modState) {
    for (const modId in mods) {
      modsWithState[modId] = {
        ...mods[modId],
        ...(profile.modState[modId] || { enabled: false, enabledTime: 0 }),
      };
    }
  }
  return {
    mods: modsWithState,
    gameMode,
    updateRunning: getSafe(
      state,
      ["session", "mods", "updatingMods", gameMode],
      false,
    ),
    isPremium: getSafe(
      state,
      ["persistent", "nexus", "userInfo", "isPremium"],
      false,
    ),
  };
}

export default translate(["common"])(
  connect(mapStateToProps)(CheckVersionsButton),
) as React.ComponentClass<IBaseProps>;
