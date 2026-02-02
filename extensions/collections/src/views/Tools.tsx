import I18next from "i18next";
import * as path from "path";
import * as React from "react";
import { ControlLabel, Image, Table } from "react-bootstrap";
import { useSelector, useStore } from "react-redux";
import { pathToFileURL } from "url";
import { actions, Icon, selectors, Toggle, types, util } from "vortex-api";

function ToolIcon(props: { gameId: string; imageUrl: string }) {
  const { gameId, imageUrl } = props;
  if (imageUrl !== undefined) {
    const src = pathToFileURL(
      path.join(util.getVortexPath("userData"), gameId, "icons", imageUrl),
    ).href;
    return <Image src={src} className={"tool-icon valid"} />;
  } else {
    return <Icon name="executable" className={"tool-icon valid"} />;
  }
}

interface IToolItemProps {
  t: I18next.TFunction;
  gameId: string;
  tool: types.IDiscoveredTool;
  enabled: boolean;
  onToggle: (newValue: boolean, dataId: string) => void;
}

function ToolItem(props: IToolItemProps) {
  const { enabled, gameId, onToggle, tool } = props;

  return (
    <tr>
      <td>
        <Toggle dataId={tool.id} checked={enabled} onToggle={onToggle} />
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
  t: I18next.TFunction;
  collection: types.IMod;
  onSetCollectionAttribute: (attrPath: string[], value: any) => void;
}

const emptyArray = [];

function Tools(props: IToolsProps) {
  const { t, collection, onSetCollectionAttribute } = props;

  const gameMode: string = useSelector(selectors.activeGameId);

  const includedTools: string[] = useSelector<types.IState, string[]>(
    (state) =>
      state.persistent.mods[gameMode][collection.id].attributes?.collection
        ?.includedTools ?? emptyArray,
  );

  const toggleCB = React.useCallback(
    (newValue: boolean, toolId: string) => {
      onSetCollectionAttribute(
        ["includedTools"],
        newValue
          ? [].concat(includedTools, [toolId])
          : includedTools.filter((id) => id !== toolId),
      );
    },
    [includedTools, onSetCollectionAttribute],
  );

  const tools = useSelector(
    (state: types.IState) => state.settings.gameMode.discovered[gameMode].tools,
  );

  const custom = Object.values(tools ?? {}).filter(
    (tool) => tool.custom && !tool.hidden,
  );

  return (
    <div className="collection-scrollable">
      <ControlLabel>
        <p>
          {t(
            "This screen lets you include tools you manually configured to be run from Vortex.",
          )}
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
              key={item.id}
              t={t}
              tool={item}
              gameId={gameMode}
              enabled={includedTools.includes(item.id)}
              onToggle={toggleCB}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default Tools;
