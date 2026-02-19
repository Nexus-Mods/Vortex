import type { Option } from "react-select";

import React from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import Select from "react-select";

import type { IDiscoveryResult, IState } from "../../../renderer/types/IState";
import type { IModWithState } from "../../mod_management/types/IModProps";
import type { IModType } from "../types/IModType";

import { IconButton } from "../../../renderer/controls/TooltipControls";
import { midClip, truthy } from "../../../renderer/util/util";
import { setModType } from "../../mod_management/actions/mods";
import { activeGameId } from "../../profile_management/selectors";
import { getGame } from "../util/getGame";
import { getModType, getModTypeExtensions } from "../util/modTypeExtensions";

export interface IModTypeWidget {
  mods: IModWithState | IModWithState[];
  copyToClipboard: (value: string) => void;
}

function ModTypeWidget(props: IModTypeWidget) {
  const mods = Array.isArray(props.mods) ? props.mods : [props.mods];

  const dispatch = useDispatch();
  const { t } = useTranslation();

  const modTypeId = mods[0].type;

  const gameMode = useSelector<IState, string>(activeGameId);
  const discovery = useSelector<IState, IDiscoveryResult>(
    (state) => state.settings.gameMode.discovered[gameMode],
  );

  const modTypes = React.useMemo(() => getModTypeExtensions(), []);
  const modTypePath = React.useMemo(() => {
    let result = "";
    const game = getGame(gameMode);
    const modType = getModType(modTypeId);
    if (modType !== undefined && game !== undefined) {
      result = modType.getPath(game);
    } else if (game !== undefined) {
      result = game.getModPaths(discovery?.path)[""];
    }
    return result;
  }, [gameMode, modTypeId]);

  const choices = React.useMemo(() => {
    return modTypes
      .filter((type: IModType) => type.isSupported(gameMode))
      .map((type: IModType) => ({
        key: type.typeId,
        text: type.options.name || type.typeId || "Default",
      }));
  }, [gameMode]);

  const onChangeValue = React.useCallback(
    (newValue: Option<string>) => {
      for (const mod of mods) {
        dispatch(setModType(gameMode, mod.id, newValue?.key || ""));
      }
    },
    [gameMode],
  );

  const toClipboard = React.useCallback(() => {
    if (modTypeId) {
      props.copyToClipboard(modTypeId);
    }
  }, [modTypeId, props.copyToClipboard]);

  const openPath = React.useCallback(() => {
    window.api.shell.openFile(modTypePath);
  }, [modTypePath]);

  if (mods[0].state !== "installed") {
    return <div>{t("Only available for installed mods")}</div>;
  }

  if (mods.find((iter) => iter.type !== modTypeId) !== undefined) {
    return <div>{t("Multiple")}</div>;
  }

  return (
    <div>
      <Select
        labelKey="text"
        options={choices}
        value={modTypeId}
        valueKey="key"
        onChange={onChangeValue}
      />

      {truthy(modTypePath) ? (
        <div>
          {t("Deploys to")}&nbsp;
          <a className="modtype-path" title={modTypePath} onClick={openPath}>
            {midClip(modTypePath, 40)}
          </a>
        </div>
      ) : (
        t("Does not deploy")
      )}

      <div>
        {t("ID:")}&nbsp;<span className="modtype-id">"{modTypeId}"</span>
        &nbsp;
        <IconButton
          className="btn-embed"
          icon="clipboard-copy"
          tooltip={t("Copy ID to clipboard")}
          onClick={toClipboard}
        />
      </div>
    </div>
  );
}

export default ModTypeWidget;
