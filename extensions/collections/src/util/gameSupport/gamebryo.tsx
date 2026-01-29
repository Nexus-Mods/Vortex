import * as path from "path";
import React = require("react");
import { ControlLabel, ListGroup, ListGroupItem, Panel } from "react-bootstrap";
import { useSelector, useStore } from "react-redux";
import { fs, log, selectors, Spinner, tooltip, types, util } from "vortex-api";
import { ICollection } from "../../types/ICollection";
import { IExtendedInterfaceProps } from "../../types/IExtendedInterfaceProps";

interface IGamebryoLO {
  name: string;
  enabled: boolean;
  loadOrder: number;
}

function getEnabledPlugins(
  state: types.IState,
  plugins: string[],
): Array<{ name: string; enabled: boolean }> {
  const gamebryoLO: { [id: string]: IGamebryoLO } = state["loadOrder"];
  return plugins
    .map((pluginName) => ({
      ...gamebryoLO[pluginName.toLowerCase()],
      name: pluginName,
    }))
    .filter(
      (lo) => lo !== undefined && lo.name !== undefined && lo.enabled === true,
    )
    .sort((lhs, rhs) => lhs.loadOrder - rhs.loadOrder)
    .map((lo) => ({ name: lo.name, enabled: lo.enabled }));
}

interface IUserlistEntry {
  name: string;
  group?: string;
  after?: string[];
}

interface IGamebryoRules {
  plugins: IUserlistEntry[];
  groups?: IUserlistEntry[];
}

function extractPluginRules(
  state: types.IState,
  plugins: string[],
): IGamebryoRules {
  const installedPlugins: Set<string> = new Set(
    plugins.map((name) => name.toLowerCase()),
  );
  const customisedPlugins = state["userlist"].plugins.filter(
    (plug: IUserlistEntry) =>
      installedPlugins.has(plug.name.toLowerCase()) &&
      (plug.after !== undefined || plug.group !== undefined),
  );

  // TODO this may be a bit overly simplified.
  // we include the rules on all plugins currently enabled but this may include plugins that
  // aren't included in the pack
  return {
    plugins: customisedPlugins,
    groups: state["userlist"].groups,
  };
}

export interface ICollectionGamebryo {
  plugins: Array<{ name: string; enabled?: boolean }>;
  pluginRules: IGamebryoRules;
}

async function getIncludedPlugins(
  gameId: string,
  stagingPath: string,
  mods: { [modId: string]: types.IMod },
  modIds: string[],
): Promise<string[]> {
  const extensions = ["fallout4", "skyrimse"].includes(gameId)
    ? new Set([".esp", ".esm", ".esl"])
    : new Set([".esp", ".esm"]);

  const includedPlugins: string[] = [];

  await Promise.all(
    modIds.map(async (modId) => {
      if (mods[modId] !== undefined) {
        try {
          const files = await fs.readdirAsync(
            path.join(stagingPath, mods[modId].installationPath),
          );
          const plugins = files.filter((fileName) =>
            extensions.has(path.extname(fileName).toLowerCase()),
          );
          includedPlugins.push(...plugins);
        } catch (err) {
          // failure to read the mod staging folder probably means something changed in parallel,
          // could be the user removing the directory or something.
          // Not really a point reporting this from this extension, if the files are gone the mod
          // contains no plugins, simple as that
          log("warn", "failed to read plugins included in mod", err.message);
        }
      }
    }),
  );

  return includedPlugins;
}

export async function generate(
  state: types.IState,
  gameId: string,
  stagingPath: string,
  modIds: string[],
  mods: { [modId: string]: types.IMod },
): Promise<ICollectionGamebryo> {
  const includedPlugins: string[] = await getIncludedPlugins(
    gameId,
    stagingPath,
    mods,
    modIds,
  );

  return {
    plugins: getEnabledPlugins(state, includedPlugins),
    pluginRules: extractPluginRules(state, includedPlugins),
  };
}

function toLootType(type: string): string {
  switch (type) {
    case "requires":
      return "req";
    case "incompatible":
      return "inc";
    default:
      return "after";
  }
}

function refName(iter: string | { name: string }): string {
  if (typeof iter === "string") {
    return iter;
  } else {
    return iter.name;
  }
}

export async function parser(
  api: types.IExtensionApi,
  gameId: string,
  collection: ICollection,
  collectionMod: types.IMod,
) {
  const state: types.IState = api.getState();

  if ((state as any).userlist === undefined) {
    // may be that the plugin extension is disabled.
    // if so, that may be intentional so can't report an error.
    return;
  }

  const mods = state.persistent.mods[gameId];

  // set up groups and their rules
  util.batchDispatch(
    api.store,
    (collection.pluginRules.groups ?? []).reduce((prev, group) => {
      if ((state as any).userlist.groups[group.name] === undefined) {
        prev.push({
          type: "ADD_PLUGIN_GROUP",
          payload: {
            group: group.name,
          },
        });
      }
      group.after.forEach((after) => {
        prev.push({
          type: "ADD_GROUP_RULE",
          payload: {
            groupId: group.name,
            reference: after,
          },
        });
      });
      return prev;
    }, []),
  );

  const collectionModIds = collectionMod.rules
    .filter((rule) => ["requires", "recommends"].includes(rule.type))
    .map((rule) => util.findModByRef(rule.reference, mods))
    .filter((mod) => !!mod)
    .map((mod) => mod.id);

  const stagingPath = selectors.installPathForGame(state, gameId);
  const includedPlugins = await getIncludedPlugins(
    gameId,
    stagingPath,
    mods,
    collectionModIds,
  );
  const isEnabled = (pluginName: string) =>
    collection.plugins.find(
      (plugin) => plugin.name === pluginName && plugin.enabled,
    ) !== undefined;

  // set up plugins and their rules
  util.batchDispatch(
    api.store,
    includedPlugins.map((plugin) => {
      return {
        type: "SET_PLUGIN_ENABLED",
        payload: {
          pluginName: plugin,
          enabled: isEnabled(plugin),
        },
      };
    }),
  );

  // dismiss all "mod x contains multiple plugins" notifications because we're enabling plugins
  // automatically.
  // this is a bit nasty because a) we're string-matching part of the notification id and b) this
  // doesn't take into account the notification may be triggered by a mod _not_ installed through
  // the pack.
  state.session.notifications.notifications
    .filter((noti) => noti.id.startsWith("multiple-plugins-"))
    .forEach((noti) => api.dismissNotification(noti.id));

  util.batchDispatch(
    api.store,
    (collection.pluginRules?.plugins ?? []).reduce((prev, plugin) => {
      const existing = (state as any).userlist.plugins.find(
        (plug) => plug.name.toUpperCase() === plugin.name.toUpperCase(),
      );

      if (plugin.group !== undefined && existing?.group === undefined) {
        prev.push({
          type: "SET_PLUGIN_GROUP",
          payload: {
            pluginId: plugin.name.toLowerCase(),
            group: plugin.group,
          },
        });
      }

      ["requires", "incompatible", "after"].forEach((type) => {
        const lootType = toLootType(type);
        (plugin[type] || []).forEach((ref) => {
          const match = (iter) =>
            refName(iter).toUpperCase() === ref.toUpperCase();

          if (
            util.getSafe(existing, [lootType], []).find(match) === undefined
          ) {
            prev.push({
              type: "ADD_USERLIST_RULE",
              payload: {
                pluginId: plugin.name.toLowerCase(),
                reference: ref,
                type,
              },
            });
          }
        });
      });
      return prev;
    }, []),
  );
}

interface ILocalizedMessage {
  lang: string;
  str: string;
}

interface IMessage {
  type: "say" | "warn" | "error";
  content: string | ILocalizedMessage[];
  condition?: string;
  subs?: string[];
}

interface IBashTag {
  name: string;
  condition?: string;
}

type BashTag = string | IBashTag;

interface ILocation {
  link: string;
}

interface IDirtyInfo {
  crc: string;
  util: string;
  itm?: number;
  udr?: number;
  nav?: number;
}

export interface ILootReference {
  name: string;
  display: string;
  condition?: string;
}

interface ILOOTPlugin {
  name: string;
  enabled?: boolean;
  group?: string;
  after?: Array<string | ILootReference>;
  req?: Array<string | ILootReference>;
  inc?: Array<string | ILootReference>;
  msg?: IMessage[];
  tag?: BashTag[];
  url?: ILocation[];
  dirty?: IDirtyInfo[];
}

interface ILOOTGroup {
  name: string;
  after?: string[];
}

interface ILOOTList {
  globals: IMessage[];
  plugins: ILOOTPlugin[];
  groups: ILOOTGroup[];
}

function ruleName(rule: string | ILootReference): string {
  if (typeof rule === "string") {
    return rule;
  } else {
    return rule.display ?? rule.name;
  }
}

function ruleId(rule: string | ILootReference): string {
  if (typeof rule === "string") {
    return rule.toLowerCase();
  } else {
    return rule.name.toLowerCase();
  }
}

function ruleType(t: types.TFunction, type: string): string {
  switch (type) {
    case "after":
      return t("after");
    case "requires":
      return t("requires");
    case "incompatible":
      return t("incompatible with");
    default:
      return "???";
  }
}

interface IRule {
  name: string;
  ref: string | ILootReference;
  type: string;
  isGroup?: boolean;
}

function renderRefName(rule: IRule): string {
  return typeof rule.ref === "string" ? rule.ref : rule.ref.display;
}

interface IPluginRuleProps {
  t: types.TFunction;
  rule: IRule;
  onRemove: (rule: IRule) => void;
}

function renderType(t: types.TFunction, type: string) {
  if (type === "assigned") {
    return t("assigned to group");
  } else {
    return t(type);
  }
}

export function PluginRule(props: IPluginRuleProps) {
  const { t, onRemove, rule } = props;

  const remove = React.useCallback(
    (evt: React.MouseEvent<any>) => {
      onRemove(rule);
    },
    [rule],
  );

  return (
    <ListGroupItem>
      <div className="rule-name">
        {rule.isGroup ? t("Group") + " " : ""}
        {rule.name}
      </div>
      <div className="rule-type">{renderType(t, rule.type)}</div>
      <div className="rule-name">{renderRefName(rule)}</div>
      <tooltip.IconButton
        className="btn-embed remove-btn"
        icon="remove"
        tooltip={t("Remove plugin rule")}
        onClick={remove}
      />
    </ListGroupItem>
  );
}

export function Interface(props: IExtendedInterfaceProps): JSX.Element {
  const { t, collection } = props;

  const [pluginRules, setPluginRules] = React.useState<IRule[]>(null);
  const [groupAssignments, setGroupAssignments] = React.useState<{
    [name: string]: string;
  }>(null);
  const store = useStore();
  const gameId = useSelector(selectors.activeGameId);
  const mods = useSelector(
    (selState: types.IState) => selState.persistent.mods[gameId],
  );
  const userlist: ILOOTList = useSelector((selState: any) => selState.userlist);

  const state = store.getState();

  React.useEffect(() => {
    // need to get list of mods, then read the directories to figure out which plugins they include
    const modIds = collection.rules
      .map((rule) => rule.reference.id)
      .filter((modId) => modId !== undefined);

    const stagingPath = selectors.installPath(state);

    getIncludedPlugins(gameId, stagingPath, mods, modIds).then((plugins) => {
      const pluginsL = plugins.map((plug) => plug.toLowerCase());

      const rules: IRule[] = [];
      const assignments: { [plugin: string]: string } = {};
      for (const plugin of plugins) {
        const plug: ILOOTPlugin = (userlist?.plugins ?? []).find(
          (iter) => iter.name.toLowerCase() === plugin.toLowerCase(),
        );

        const byRef = (name: string | ILootReference): boolean =>
          pluginsL.includes(ruleId(name));
        const toRule = (ref: string | ILootReference, type: string) => ({
          name: plugin,
          ref,
          type,
        });

        if (plug !== undefined) {
          rules.push(
            ...(plug.after ?? [])
              .filter(byRef)
              .map((aft) => toRule(aft, "after")),
          );
          rules.push(
            ...(plug.req ?? [])
              .filter(byRef)
              .map((req) => toRule(req, "requires")),
          );
          rules.push(
            ...(plug.inc ?? [])
              .filter(byRef)
              .map((inc) => toRule(inc, "incompatible")),
          );

          if (plug.group !== undefined) {
            assignments[plug.name] = plug.group;
          }
        }
      }
      setPluginRules(rules);
      setGroupAssignments(assignments);
    });
  }, [collection, mods, userlist, setPluginRules]);

  const removeRule = React.useCallback(
    (rule: IRule) => {
      store.dispatch({
        type: "REMOVE_USERLIST_RULE",
        payload: {
          pluginId: rule.name.toLowerCase(),
          reference: rule.ref,
          type: rule.type,
        },
      });
    },
    [store],
  );

  const removeGroupRule = React.useCallback(
    (rule: IRule) => {
      store.dispatch({
        type: "REMOVE_GROUP_RULE",
        payload: {
          groupId: rule.name.toLowerCase(),
          reference: rule.ref,
        },
      });
    },
    [store],
  );

  const unassignGroup = React.useCallback(
    (rule: IRule) => {
      store.dispatch({
        type: "SET_PLUGIN_GROUP",
        payload: {
          pluginId: rule.name.toLowerCase(),
          group: undefined,
        },
      });
    },
    [store],
  );

  if (userlist === undefined) {
    // early out if no userlist loaded
    return (
      <Panel>
        {t(
          "No userlist loaded, is the gamebryo-plugin-management extension disabled?",
        )}
      </Panel>
    );
  }

  const grpsFlattened: IRule[] = (userlist?.groups ?? []).reduce(
    (prev: IRule[], grp) => {
      (grp.after ?? []).forEach((aft) => {
        prev.push({ name: grp.name, ref: aft, type: "after" });
      });
      return prev;
    },
    [],
  );

  return (
    <div className="collection-rules-edit collection-scrollable">
      <ControlLabel>
        <p>
          {t(
            "The collection will include your custom load order rules so that " +
              "users of your collection will get the same load order.",
          )}
          <br />
          {t("Rules you remove here are also removed from your actual setup.")}
        </p>
      </ControlLabel>
      {pluginRules !== null ? (
        <ListGroup>
          {pluginRules.map((rule) => (
            <PluginRule
              t={t}
              key={`${rule.name}_after_${rule.ref}`}
              rule={rule}
              onRemove={removeRule}
            />
          ))}
        </ListGroup>
      ) : (
        <Spinner />
      )}
      {groupAssignments !== null ? (
        <ListGroup>
          {Object.keys(groupAssignments).map((pluginName) => (
            <PluginRule
              t={t}
              key={`${pluginName}_assigned_${groupAssignments[pluginName]}`}
              rule={{
                name: pluginName,
                type: "assigned",
                ref: groupAssignments[pluginName],
              }}
              onRemove={unassignGroup}
            />
          ))}
        </ListGroup>
      ) : (
        <Spinner />
      )}
      <ListGroup>
        {grpsFlattened.map((grp) => (
          <PluginRule
            t={t}
            key={`${grp.name}_after_${grp.ref}`}
            rule={grp}
            onRemove={removeGroupRule}
          />
        ))}
      </ListGroup>
    </div>
  );
}
