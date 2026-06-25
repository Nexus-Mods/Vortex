import * as path from "path";
import { pathToFileURL } from "url";

import type { TFunction } from "i18next";
import * as React from "react";
import { ControlLabel, Image, Table } from "react-bootstrap";
import { useSelector, useStore } from "react-redux";

import * as actions from "../../../actions";
import Icon from "../../../controls/Icon";
import Toggle from "../../../controls/Toggle";
import type { IMod } from "../../../extensions/mod_management/types/IMod";
import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { IState } from "../../../types/IState";
import getVortexPath from "../../../util/getVortexPath";
import * as selectors from "../../../util/selectors";

function ToolIcon(props: { gameId: string; imageUrl: string }) {
  const { gameId, imageUrl } = props;
  if (imageUrl !== undefined) {
    const src = pathToFileURL(path.join(getVortexPath("userData"), gameId, "icons", imageUrl)).href;
    return <Image className={"tool-icon valid"} src={src} />;
  } else {
    return <Icon className={"tool-icon valid"} name="executable" />;
  }
}

interface IToolItemProps {
  t: TFunction;
  gameId: string;
  tool: IDiscoveredTool;
  enabled: boolean;
  onToggle: (newValue: boolean, dataId: string) => void;
}

function ToolItem(props: IToolItemProps) {
  const { enabled, gameId, onToggle, tool } = props;

  return (
    <tr>
      <td>
        <Toggle checked={enabled} dataId={tool.id} onToggle={onToggle} />
      </td>

      <td>
        <ToolIcon gameId={gameId} imageUrl={tool.logo} />
      </td>

      <td>{tool.name}</td>

      <td>{tool.path}</td>

      <td>{(tool.parameters ?? []).join(" ")}</td>

      <td>
        {Object.keys(tool.environment ?? {})
          .map((key) => `${key}=${tool.environment[key]}`)
          .join(", ")}
      </td>
    </tr>
  );
}

interface IToolsProps {
  t: TFunction;
  collection: IMod;
  onSetCollectionAttribute: (attrPath: string[], value: any) => void;
}

const emptyArray = [];

function Tools(props: IToolsProps) {
  const { t, collection, onSetCollectionAttribute } = props;

  const gameMode: string = useSelector(selectors.activeGameId);

  const includedTools: string[] = useSelector<IState, string[]>(
    (state) =>
      state.persistent.mods[gameMode][collection.id].attributes?.collection?.includedTools ??
      emptyArray,
  );

  const toggleCB = React.useCallback(
    (newValue: boolean, toolId: string) => {
      onSetCollectionAttribute(
        ["includedTools"],
        newValue ? [].concat(includedTools, [toolId]) : includedTools.filter((id) => id !== toolId),
      );
    },
    [includedTools, onSetCollectionAttribute],
  );

  const tools = useSelector((state: IState) => state.settings.gameMode.discovered[gameMode].tools);

  const custom = Object.values(tools ?? {}).filter((tool) => tool.custom && !tool.hidden);

  return (
    <div className="collection-scrollable">
      <ControlLabel>
        <p>
          {t("This screen lets you include tools you manually configured to be run from Vortex.")}
        </p>

        <p>
          {t(
            "Obviously users will need to have these tools installed. If they aren't " +
              "included in the game and not installed as a mod through this collection, " +
              "you should include instructions for the user on how to get the tool.",
          )}
        </p>
      </ControlLabel>

      <Table id="collection-tools-table">
        <thead>
          <tr>
            <th className="header-status">{t("Status")}</th>

            <th className="header-icon">{t("Icon")}</th>

            <th className="header-name">{t("Name")}</th>

            <th className="header-path">{t("Path")}</th>

            <th className="header-args">{t("Args")}</th>

            <th className="header-env">{t("Environment")}</th>
          </tr>
        </thead>

        <tbody>
          {custom.map((item) => (
            <ToolItem
              enabled={includedTools.includes(item.id)}
              gameId={gameMode}
              key={item.id}
              t={t}
              tool={item}
              onToggle={toggleCB}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default Tools;
