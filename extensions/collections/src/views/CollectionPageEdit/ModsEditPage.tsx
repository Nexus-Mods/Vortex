import { ICollectionSourceInfo, SourceType } from "../../types/ICollection";

import I18next from "i18next";
import * as _ from "lodash";
import * as path from "path";
import * as React from "react";
import { Button } from "react-bootstrap";

import InstallModeRenderer from "./InstallModeRenderer";

import {
  ComponentEx,
  EmptyPlaceholder,
  fs,
  Icon,
  ITableRowAction,
  OptionsFilter,
  selectors,
  Table,
  TableTextFilter,
  tooltip,
  types,
  Usage,
  util,
} from "vortex-api";
import { ADULT_CONTENT_URL, INSTRUCTIONS_PLACEHOLDER } from "../../constants";

export interface IModsPageProps {
  t: I18next.TFunction;
  collection: types.IMod;
  mods: { [modId: string]: types.IMod };
  showPhaseUsage: boolean;
  showBinpatchWarning: boolean;
  onSetModVersion: (modId: string, version: "exact" | "newest") => void;
  onAddRule: (rule: types.IModRule) => void;
  onRemoveRule: (rule: types.IModRule) => void;
  onSetCollectionAttribute: (path: string[], value: any) => void;
  onAddModsDialog: (modId: string) => void;
  onDismissPhaseUsage: () => void;
  onDismissBinpatchWarning: () => void;
  onShowPhaseColumn: () => void;
}

interface IModEntry {
  rule: types.IModRule;
  mod: types.IMod;
}

type ProblemType =
  | "invalid-ids"
  | "replicate-fuzzy-version"
  | "choices-fuzzy-version"
  | "bundled-fuzzy-version"
  | "web-fuzzy-version"
  | "web-url-missing"
  | "bundle-copyright"
  | "direct-download"
  | "installer-choices-not-saved"
  | "no-version-set"
  | "local-edits-fuzzy-version"
  | "local-edits-bundle"
  | "replicate-vs-binpatch";
interface IProblem {
  type: ProblemType;
  summary: string;
  message: string;
}

interface IModsPageState {
  entries: { [modId: string]: IModEntry };
  problems: { [modId: string]: IProblem[] };
}

type IProps = IModsPageProps;

const SOURCES = {
  nexus: "Nexus Mods",
  direct: "Direct download",
  browse: "Browse a website",
  bundle: "Bundle with collection",
};

const INSTALL_MODES = {
  fresh: "Fresh Install",
  choices: "Same Installer Options",
  clone: "Replicate",
};

const getCollator = (() => {
  let lang: string;
  let collator: Intl.Collator;
  return (locale: string) => {
    if (collator === undefined || locale !== lang) {
      lang = locale;
      collator = new Intl.Collator(locale, { sensitivity: "base" });
    }
    return collator;
  };
})();

function undefSort(lhs: any, rhs: any) {
  return lhs !== undefined ? 1 : rhs !== undefined ? -1 : 0;
}

function modNameSort(
  lhs: types.IMod,
  rhs: types.IMod,
  collator: Intl.Collator,
  sortDir: string,
): number {
  const lhsName = util.renderModName(lhs);
  const rhsName = util.renderModName(rhs);
  return lhsName === undefined || rhsName === undefined
    ? undefSort(lhsName, rhsName)
    : collator.compare(lhsName, rhsName) * (sortDir !== "desc" ? 1 : -1);
}

function sortCategories(
  lhs: types.IMod,
  rhs: types.IMod,
  collator: Intl.Collator,
  state: any,
  sortDir: string,
): number {
  const lhsCat = util.resolveCategoryName(lhs?.attributes?.category, state);
  const rhsCat = util.resolveCategoryName(rhs?.attributes?.category, state);
  return lhsCat === rhsCat
    ? modNameSort(lhs, rhs, collator, sortDir)
    : collator.compare(lhsCat, rhsCat);
}

const coerceableRE = /^v?[0-9.]+$/;

function safeCoerce(input: string): string {
  return coerceableRE.test(input)
    ? (util.coerceToSemver(input) ?? input)
    : input;
}

class ModsEditPage extends ComponentEx<IProps, IModsPageState> {
  private mLang: string;
  private mCollator: Intl.Collator;

  private mColumns: Array<types.ITableAttribute<IModEntry>>;

  private mActions: ITableRowAction[] = [
    {
      title: "Requires",
      icon: "requires",
      singleRowAction: false,
      multiRowAction: true,
      condition: (instanceIds: string[]) =>
        instanceIds.find(
          (id) => this.state.entries[id]?.rule?.type === "recommends",
        ) !== undefined,
      action: (instanceIds: string[]) => {
        const { onAddRule, onRemoveRule } = this.props;
        const { entries } = this.state;
        instanceIds.forEach((id) => {
          if (entries[id]?.rule?.type === "recommends") {
            const newRule = _.cloneDeep(entries[id].rule);
            onRemoveRule(entries[id].rule);
            newRule.type = "requires";
            onAddRule(newRule);
          }
        });
      },
    },
    {
      title: "Recommends",
      icon: "recommends",
      singleRowAction: false,
      multiRowAction: true,
      condition: (instanceIds: string[]) =>
        instanceIds.find(
          (id) => this.state.entries[id]?.rule?.type === "requires",
        ) !== undefined,
      action: (instanceIds: string[]) => {
        const { onAddRule, onRemoveRule } = this.props;
        const { entries } = this.state;
        instanceIds.forEach((id) => {
          if (entries[id].rule?.type === "requires") {
            const newRule = _.cloneDeep(entries[id].rule);
            onRemoveRule(entries[id].rule);
            newRule.type = "recommends";
            onAddRule(newRule);
          }
        });
      },
    },
    {
      title: "Set Install Type",
      icon: "edit",
      singleRowAction: false,
      multiRowAction: true,
      action: (instanceIds: string[]) => {
        const { onSetCollectionAttribute, collection } = this.props;

        const refMode =
          collection.attributes?.collection?.installMode?.[instanceIds[0]] ??
          "fresh";

        this.context.api
          .showDialog(
            "question",
            "Install Type",
            {
              text: "Please select the install mode to apply to all selected mods",
              choices: [
                {
                  id: "fresh",
                  text: "Fresh Install",
                  value: refMode === "fresh",
                },
                {
                  id: "choices",
                  text: "Same Installer Options",
                  value: refMode === "choices",
                },
                { id: "clone", text: "Replicate", value: refMode === "clone" },
              ],
            },
            [{ label: "Cancel" }, { label: "Apply" }],
          )
          .then((result) => {
            if (result.action === "Apply") {
              const selected = Object.keys(result.input).find(
                (iter) => result.input[iter],
              );
              instanceIds.forEach((modId) => {
                onSetCollectionAttribute(["installMode", modId], selected);
              });
            }
          });
      },
    },
    {
      title: "Set Version",
      icon: "auto-update",
      singleRowAction: false,
      multiRowAction: true,
      action: (instanceIds: string[]) => {
        this.context.api
          .showDialog(
            "question",
            "Version Match",
            {
              text:
                "Please choose how Vortex should choose the version of the mod to be installed. " +
                '"Exact" means that the user should install the same version as you have ' +
                'installed right now. "Latest" means it should get the newest version at ' +
                "the time of installation.",
              choices: [
                { id: "prefer", text: "Prefer exact", value: true },
                { id: "latest", text: "Latest", value: false },
                { id: "exact", text: "Exact only", value: false },
              ],
            },
            [{ label: "Cancel" }, { label: "Apply" }],
          )
          .then((result) => {
            if (result.action === "Apply") {
              const { onAddRule, onRemoveRule } = this.props;
              const { entries } = this.state;

              const selected = Object.keys(result.input).find(
                (iter) => result.input[iter],
              );
              instanceIds.forEach((modId) => {
                const entry = entries[modId];
                if (entry.mod !== undefined) {
                  const newRule = _.cloneDeep(entry.rule);
                  newRule.reference.versionMatch =
                    selected === "exact"
                      ? entry.mod.attributes["version"]
                      : selected === "prefer"
                        ? ">=" + entry.mod.attributes["version"] + "+prefer"
                        : "*";

                  onRemoveRule(entry.rule);
                  onAddRule(newRule);
                }
              });
            }
          });
      },
    },
    {
      title: "Remove",
      icon: "delete",
      singleRowAction: true,
      multiRowAction: true,
      action: (instanceIds: string[]) => {
        const { entries } = this.state;
        const filteredIds = instanceIds.filter(
          (id) => entries[id] !== undefined,
        );

        this.context.api.showDialog(
          "question",
          "Confirm removal",
          {
            text: "Are you sure you want to remove these mods from this collection? Removing the mods from the collection will not remove them from Vortex.",
            message: filteredIds
              .map((id) =>
                entries[id].mod !== undefined
                  ? util.renderModName(entries[id].mod)
                  : util.renderModReference(entries[id].rule.reference),
              )
              .join("\n"),
          },
          [
            { label: "Cancel" },
            {
              label: "Remove",
              action: () => {
                filteredIds.forEach((id) => {
                  if (entries[id] !== undefined) {
                    this.props.onRemoveRule(entries[id].rule);
                    delete this.nextState.entries[id];
                  }
                });
              },
            },
          ],
        );
      },
    },
    {
      icon: "sort-none",
      title: "Assign order",
      subMenus: (instanceIds: string | string[]) => {
        const { t } = this.props;
        const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
        const maxPhase = Object.values(this.state.entries).reduce(
          (prev, entry) => Math.max(prev, entry.rule.extra?.["phase"] ?? 0),
          0,
        );
        return new Array(maxPhase + 1)
          .fill(0)
          .map((ignore, idx) => {
            const item: ITableRowAction = {
              title: t("Phase {{num}}", { replace: { num: idx } }),
              action: () => {
                ids.forEach((id) => {
                  this.setPhase(this.state.entries[id], idx);
                });
              },
            };
            return item;
          })
          .concat({
            title: t("Create & Add to Phase {{num}}", {
              replace: { num: maxPhase + 1 },
            }),
            action: () => {
              ids.forEach((id) => {
                this.setPhase(this.state.entries[id], maxPhase + 1);
              });
            },
          });
      },
      singleRowAction: true,
    } as any,
  ];

  constructor(props: IProps) {
    super(props);

    const entries = this.generateEntries(props);
    this.initState({
      entries,
      problems: this.checkProblems(props, entries),
    });

    this.mColumns = [
      {
        id: "name",
        name: "Mod Name",
        description: "Mod Name",
        calc: (entry: IModEntry) =>
          entry.mod !== undefined
            ? util.renderModName(entry.mod)
            : util.renderModReference(entry.rule.reference),
        placement: "table",
        edit: {},
        isDefaultSort: true,
        isSortable: true,
        filter: new TableTextFilter(true),
        sortFunc: (lhs: string, rhs: string, locale: string): number => {
          if (this.mCollator === undefined || locale !== this.mLang) {
            this.mLang = locale;
            this.mCollator = new Intl.Collator(locale, { sensitivity: "base" });
          }
          return this.mCollator.compare(lhs, rhs);
        },
      },
      {
        id: "tags",
        name: "Tag",
        description: "Mod Highlights",
        customRenderer: (entry: IModEntry) => {
          if (entry.mod === undefined) {
            return (
              <tooltip.Icon
                name="feedback-error"
                tooltip={this.props.t("This mod isn't installed.")}
              />
            );
          }

          const color = util.getSafe(entry.mod.attributes, ["color"], "");
          const icon = util.getSafe(entry.mod.attributes, ["icon"], "");
          const hasProblem =
            this.state.problems[entry.mod.id] !== undefined &&
            this.state.problems[entry.mod.id].length > 0;
          const hasHighlight = color || icon;

          if (!color && !icon && !hasProblem) {
            return null;
          }
          return (
            <>
              {hasHighlight ? (
                <Icon
                  className={
                    "highlight-base " +
                    (color !== "" ? color : "highlight-default")
                  }
                  name={icon !== "" ? icon : "highlight"}
                />
              ) : null}
              {hasProblem ? (
                <tooltip.IconButton
                  icon="incompatible"
                  className="btn-embed"
                  tooltip={this.state.problems[entry.mod.id]
                    .map((problem) => problem.summary)
                    .join("\n")}
                  data-modid={entry.mod.id}
                  onClick={this.showProblems}
                />
              ) : null}
            </>
          );
        },
        calc: (entry: IModEntry) => {
          if (entry.mod === undefined) {
            return ["not-installed", "has-problems"];
          }
          const color = entry.mod.attributes?.color ?? "";
          const icon = entry.mod.attributes?.icon ?? "";
          const problems = this.state.problems[entry.mod.id] || [];

          return [
            color,
            icon,
            problems.length > 0 ? "has-problems" : "no-problems",
          ];
        },
        placement: "table",
        edit: {},
        filter: new OptionsFilter(
          [{ value: "has-problems", label: "Has Problems" }],
          false,
          false,
        ),
      },
      {
        id: "category",
        name: "Category",
        description: "Mod Category",
        icon: "sitemap",
        placement: "table",
        calc: (mod: IModEntry) =>
          util.resolveCategoryName(
            mod.mod?.attributes?.category,
            this.context.api.store.getState(),
          ),
        isToggleable: true,
        edit: {},
        isSortable: true,
        isGroupable: (mod: IModEntry, t: types.TFunction) =>
          util.resolveCategoryName(
            mod.mod?.attributes?.category,
            this.context.api.store.getState(),
          ) || t("<No category>"),
        filter: new OptionsFilter(
          () => {
            const state: types.IState = this.context.api.getState();
            return Array.from(
              new Set(
                Object.values(this.state.entries)
                  .map((entry) => entry.mod?.attributes?.category)
                  .filter((entry) => !!entry)
                  .map((entry) => util.resolveCategoryName(entry, state))
                  .sort(),
              ),
            ).map((name) => {
              return { value: name, label: name };
            });
          },
          false,
          false,
        ),
        sortFuncRaw: (lhs: IModEntry, rhs: IModEntry, locale: string): number =>
          sortCategories(
            lhs.mod,
            rhs.mod,
            getCollator(locale),
            this.context.api.store.getState(),
            this.categorySort(),
          ),
      },
      {
        id: "required",
        name: "Required",
        description:
          "Whether the entire collection will fail if this mod is missing",
        calc: (mod: IModEntry) => {
          return mod.rule.type === "requires" ? true : false;
        },
        placement: "table",
        edit: {
          inline: true,
          actions: false,
          choices: () => [
            { key: "required", bool: true } as any,
            { key: "optional", bool: false } as any,
          ],
          onChangeValue: (source: IModEntry, value: any) => {
            this.props.onRemoveRule(source.rule);
            const newRule = _.cloneDeep(source.rule);
            newRule.type = value ? "requires" : "recommends";
            this.props.onAddRule(newRule);
          },
        },
      },
      {
        id: "source",
        name: "Source",
        description: "How the user acquires the mod",
        calc: (entry: IModEntry) => {
          const id = entry.mod?.id ?? entry.rule?.reference?.id;
          const { collection } = this.props;
          const type = util.getSafe(
            collection,
            ["attributes", "collection", "source", id, "type"],
            "nexus",
          );
          return SOURCES[type];
        },
        placement: "table",
        edit: {
          inline: true,
          actions: false,
          choices: () =>
            Object.keys(SOURCES).map((key) => ({ key, text: SOURCES[key] })),
          onChangeValue: (entry: IModEntry, value: any) => {
            const id = entry.mod?.id ?? entry.rule?.reference?.id;
            if (id !== undefined) {
              this.querySource(id, value);
            }
          },
        },
      },
      {
        id: "edit-source",
        placement: "table",
        edit: {},
        calc: (entry: IModEntry) => {
          const { collection } = this.props;
          const id = entry.mod?.id ?? entry.rule?.reference?.id;

          const type = util.getSafe(
            collection,
            ["attributes", "collection", "source", id, "type"],
            "nexus",
          );
          return SOURCES[type];
        },
        customRenderer: (entry: IModEntry) => {
          const { t, collection } = this.props;
          const id = entry.mod?.id ?? entry.rule?.reference?.id;
          const type = util.getSafe(
            collection,
            ["attributes", "collection", "source", id, "type"],
            "nexus",
          );
          return (
            <tooltip.IconButton
              icon="edit"
              disabled={
                entry.mod === undefined || ["nexus", "bundle"].includes(type)
              }
              tooltip={t("Edit Source")}
              data-modid={id}
              onClick={this.onQuerySource}
            />
          );
        },
      },
      {
        id: "version-match",
        name: "Version",
        description: "The version to install",
        calc: (entry: IModEntry) => {
          const { collection } = this.props;
          const { t } = this.props;
          const id = entry.mod?.id ?? entry.rule?.reference?.id;
          const version = entry.mod?.attributes?.["version"] ?? t("N/A");

          if (
            collection.attributes?.collection?.source?.[id]?.type === "bundle"
          ) {
            return t("Exact only ({{version}})", { replace: { version } });
          }

          if (entry.rule.reference.versionMatch === "*") {
            return t("Latest");
          } else if (
            (entry.rule.reference.versionMatch || "").endsWith("+prefer")
          ) {
            return t("Prefer exact ({{version}})", { replace: { version } });
          } else {
            return t("Exact only ({{version}})", { replace: { version } });
          }
        },
        placement: "table",
        edit: {
          inline: true,
          actions: false,
          choices: (entry: IModEntry) => {
            const { t, collection } = this.props;
            const id = entry.mod?.id ?? entry.rule?.reference?.id;
            const version = entry.mod?.attributes?.["version"] ?? t("N/A");

            if (
              collection.attributes?.collection?.source?.[id]?.type === "bundle"
            ) {
              return [
                {
                  key: "exact",
                  text: t("Exact only ({{version}})", { replace: { version } }),
                },
              ];
            }

            return [
              {
                key: "exact",
                text: t("Exact only ({{version}})", { replace: { version } }),
              },
              {
                key: "prefer",
                text: t("Prefer exact ({{version}})", { replace: { version } }),
              },
              { key: "newest", text: t("Latest") },
            ];
          },
          onChangeValue: (entry: IModEntry, value: any) => {
            if (entry.mod === undefined) {
              return;
            }

            const newRule = _.cloneDeep(entry.rule);
            this.props.onRemoveRule(entry.rule);
            newRule.reference.versionMatch =
              value === "exact"
                ? entry.mod.attributes["version"]
                : value === "prefer"
                  ? ">=" + entry.mod.attributes["version"] + "+prefer"
                  : "*";
            this.props.onAddRule(newRule);
          },
        },
      },
      {
        id: "install-type",
        name: "Install",
        description: "How the mod should be installed on the user system",
        filter: new OptionsFilter(
          [{ value: "has-install-options", label: "Has Installation Options" }],
          false,
          false,
        ),
        calc: (entry: IModEntry) => {
          const { collection } = this.props;
          const id = entry.mod?.id ?? entry.rule?.reference?.id;

          if (
            collection.attributes?.collection?.source?.[id]?.type === "bundle"
          ) {
            return INSTALL_MODES["clone"];
          }

          const hasInstallerOptions =
            (entry.mod?.attributes?.installerChoices?.options ?? []).length > 0;

          const installMode = util.getSafe(
            collection,
            ["attributes", "collection", "installMode", id],
            "fresh",
          );
          return [
            INSTALL_MODES[installMode],
            hasInstallerOptions ? "has-install-options" : "no-options",
          ];
        },
        placement: "table",
        help:
          'If set to "Fresh Install" the mod will simply be installed fresh on the users system, ' +
          "installer (if applicable) and everything.\n" +
          'If set to "Replicate" Vortex will try to replicate your exact setup for this mod. ' +
          "This does not bundle the mod itself but the list of files to install and patches if " +
          "necessary. This may increase the size of the collection and the time it takes to " +
          "export it considerably.",
        edit: {},
        customRenderer: (entry: IModEntry) => {
          const { t, collection } = this.props;
          const id = entry.mod?.id ?? entry.rule?.reference?.id;

          const hasInstallerOptions =
            (entry.mod?.attributes?.installerChoices?.options ?? []).length > 0;

          const installMode = util.getSafe(
            collection,
            ["attributes", "collection", "installMode", id],
            "fresh",
          );

          return (
            <InstallModeRenderer
              hasInstallerOptions={hasInstallerOptions}
              currentInstallMode={installMode}
              modId={id}
              onSetInstallMode={this.changeInstallMode}
              options={INSTALL_MODES}
            />
          );
        },
      },
      {
        id: "instructions",
        name: "Instructions",
        icon: "edit",
        calc: (entry: IModEntry) => {
          const { collection } = this.props;

          if (entry.mod === undefined) {
            return null;
          }

          return collection.attributes?.collection?.instructions?.[
            entry.mod.id
          ];
        },
        customRenderer: (
          entry: IModEntry,
          detailCell: boolean,
          t: types.TFunction,
        ) => {
          const { collection } = this.props;

          if (entry.mod === undefined) {
            return null;
          }

          const instructions =
            collection.attributes?.collection?.instructions?.[entry.mod.id];
          return !!instructions ? (
            <tooltip.IconButton
              icon="edit"
              tooltip={t("Edit Instructions")}
              data-modid={entry.mod.id}
              onClick={this.changeInstructions}
            >
              {t("Edit")}
            </tooltip.IconButton>
          ) : (
            <tooltip.IconButton
              icon="add"
              tooltip={t("Add Instructions")}
              data-modid={entry.mod.id}
              onClick={this.changeInstructions}
            >
              {t("Add")}
            </tooltip.IconButton>
          );
        },
        placement: "table",
        edit: {},
      },
      {
        id: "local_edits",
        name: "Binary patching",
        icon: "edit",
        help:
          "With this option enabled, any changes you did to the files in this mods will " +
          "also be included in the Collection.",
        placement: "table",
        calc: (entry: IModEntry) => {
          const { collection } = this.props;

          if (entry.mod === undefined) {
            return false;
          }

          return (
            collection.attributes?.collection?.saveEdits?.[entry.mod.id] ??
            false
          );
        },
        edit: {
          choices: () => [
            { key: "ignore", bool: false } as any,
            { key: "save", bool: true } as any,
          ],
          inline: true,
          actions: false,
          onChangeValue: (source: IModEntry, value: any) => {
            (async () => {
              if (source.mod === undefined) {
                // mod not/no longer installed?
                return;
              }
              if (value && this.props.showBinpatchWarning) {
                const result = await this.context.api.showDialog(
                  "question",
                  "Save Local Edits",
                  {
                    bbcode:
                      "With this option enabled, when you upload the Collection Vortex will " +
                      "compare your files on disk against the archive provided by the mod author " +
                      "and include patches so that any modifications get replicated when a user " +
                      "installs your collection.\n" +
                      "This allows for more customization but there are considerable drawbacks:\n" +
                      "[list]" +
                      "[*]Uploading the collection will take longer - a lot if it's a big mod\n" +
                      "[*]these patches apply only to the exact same version&variant of the mod, " +
                      "if the user updates the mod the patch will be undone." +
                      "[/list]\n" +
                      "Therefore please only use this option if you absolutely have to.",
                    checkboxes: [
                      {
                        id: "dont_show_again",
                        value: false,
                        text: "Don't show again",
                      },
                    ],
                  },
                  [{ label: "Cancel" }, { label: "Enable" }],
                );
                if (result.action === "Enable") {
                  const state = this.context.api.getState();

                  if (result.input["dont_show_again"]) {
                    this.props.onDismissBinpatchWarning();
                  }

                  const gameMode = selectors.activeGameId(state);
                  const archive =
                    state.persistent.downloads.files[source.mod.archiveId];
                  const dlPath = selectors.downloadPathForGame(state, gameMode);
                  if (archive !== undefined) {
                    try {
                      await fs.statAsync(path.join(dlPath, archive.localPath));
                      // await scanForDiffs(this.context.api, gameMode, source.mod.id);
                      this.props.onSetCollectionAttribute(
                        ["saveEdits", source.mod.id],
                        value,
                      );
                    } catch (err) {
                      if (err.code === "ENOENT") {
                        this.context.api.showErrorNotification(
                          'Failed to enable "Local Edits"',
                          "To enable this feature, the corresponding archive has to exist to " +
                            "compare against.",
                          { allowReport: false },
                        );
                      } else {
                        this.context.api.showErrorNotification(
                          'Failed to enable "Local Edits"',
                          err,
                        );
                      }
                    }
                  }
                }
              } else {
                this.props.onSetCollectionAttribute(
                  ["saveEdits", source.mod.id],
                  value,
                );
              }
            })();
          },
        },
      },
      {
        id: "phase",
        name: "Phase",
        placement: "table",
        isToggleable: true,
        isSortable: true,
        isDefaultVisible: false,
        groupName: (phase: any) =>
          this.props.t("Phase {{phase}}", {
            replace: { phase: (phase || 0).toString() },
          }),
        isGroupable: true,
        calc: (mod) => mod.rule.extra?.["phase"] ?? 0,
        edit: {},
      },
    ];
  }

  public UNSAFE_componentWillMount() {
    const entries = this.generateEntries(this.props);
    this.nextState.entries = entries;
    this.nextState.problems = this.checkProblems(this.props, entries);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (
      newProps.mods !== this.props.mods ||
      newProps.collection !== this.props.collection
    ) {
      const entries = this.generateEntries(newProps);
      this.nextState.entries = entries;
      this.nextState.problems = this.checkProblems(newProps, entries);
    }
  }

  public render(): React.ReactNode {
    const { t } = this.props;
    const { entries } = this.state;

    const addModsButton = () => {
      return (
        <Button
          id="btn-more-mods"
          className="collection-add-mods-btn"
          onClick={this.addMods}
        >
          <Icon name="add" />
          {t("Add more mods")}
        </Button>
      );
    };

    if (Object.keys(entries).length === 0) {
      return (
        <EmptyPlaceholder
          icon="layout-list"
          text={t("There are no mods in this collection")}
          // subtext={t('Is it a collection when there\'s nothing in it?')}
          subtext={addModsButton()}
          fill={true}
        />
      );
    }

    return (
      <div className="collection-mods-container">
        <Table
          tableId="collection-mods"
          data={entries}
          staticElements={this.mColumns}
          actions={this.mActions}
          showDetails={false}
        >
          <div id="collection-add-mods-container">{addModsButton()}</div>
        </Table>
        <Usage infoId="collection-mods">
          <p>{t("Here you can configure which mods to install and how.")}</p>
          <p>
            {t(
              "Version: Choose whether the collection will install exactly the version you " +
                "have yourself or whatever is current on Nexus Mods.",
            )}
          </p>
          <p>
            {t(
              "Required: Select whether the user has to install the mod or whether it's an optional recommendation, recommended mods are presented last and the user is given the choice to install them or not.",
            )}
          </p>
          <p>
            {t(
              'Install: "Fresh Install" will install the mod as Vortex would usually do, ' +
                'installer dialog and everything. "Replicate" will extract only the files you have ' +
                "extracted yourself, in exactly the same location. This basically ensures the user " +
                "gets the same options as you without having to pick them but it only works when you " +
                'have selected "Exact version" in the Version column. It will also considerably ' +
                "increase the time it takes to build the pack.",
            )}
          </p>
          <p>
            {t(
              'Source: Decides how the user downloads the mod. "Nexus Mods" is easiest, use the ' +
                "other options when the mod in only hosted on a different source. " +
                'The options also include "pack" which bundles the mod directly into the collection. ' +
                "Do this only for stuff created during setup (e.g. generated LODs, " +
                "customized configuration files and such). " +
                "You must not include any material you don't hold the copyright to. " +
                "Also: Do not provide direct download links unless you have express permission to " +
                "do so.",
            )}
          </p>
        </Usage>
      </div>
    );
  }

  private categorySort() {
    const state: types.IState = this.context.api.getState();
    return (
      state.settings.tables.mods.attributes?.["category"]?.sortDirection ??
      "none"
    );
  }

  private addMods = () => {
    const { collection, onAddModsDialog } = this.props;
    onAddModsDialog(collection.id);
  };

  private generateEntries(props: IProps) {
    const { collection, mods } = props;

    if (collection === undefined || collection.rules === undefined) {
      return {};
    }

    return Object.values(collection.rules)
      .filter((rule) => ["requires", "recommends"].indexOf(rule.type) !== -1)
      .reduce((prev, rule) => {
        const mod = util.findModByRef(
          _.omit(rule.reference, ["versionMatch"]),
          mods,
        );
        const id = mod?.id ?? rule.reference.id ?? rule.reference.idHint;
        if (id !== undefined) {
          prev[id] = { rule, mod };
        }
        return prev;
      }, {});
  }

  private checkProblems(
    props: IProps,
    entries: { [modId: string]: IModEntry },
  ): { [modId: string]: IProblem[] } {
    return Object.values(entries).reduce((prev, entry) => {
      const id =
        entry.mod?.id ?? entry.rule.reference.id ?? entry.rule.reference.idHint;
      if (id !== undefined) {
        prev[id] = this.updateProblems(props, entry);
      }
      return prev;
    }, {});
  }

  private updateProblems(props: IProps, entry: IModEntry): IProblem[] {
    const { t, collection } = props;

    if (entry.mod === undefined) {
      return;
    }

    const res: IProblem[] = [];

    const attributes = collection.attributes?.collection;

    const source = attributes?.source?.[entry.mod.id];
    const sourceType: string = source?.type ?? "nexus";
    const installMode: string =
      attributes?.installMode?.[entry.mod.id] ?? "fresh";
    const saveEdits: boolean = attributes?.saveEdits?.[entry.mod.id] ?? false;

    const { versionMatch } = entry.rule.reference;

    if (
      sourceType === "nexus" &&
      (isNaN(entry.mod.attributes?.modId) ||
        isNaN(entry.mod.attributes?.fileId))
    ) {
      res.push({
        type: "invalid-ids",
        summary: t("Missing file identifiers"),
        message: t(
          'When using "Nexus Mods" as a source, both the mod id and file id have to be ' +
            "known. If you didn't download the mod through Vortex they may not be set. " +
            'To solve this you have to change the source of the mod to "Nexus Mods" ' +
            'and use the options below "Nexus Mods IDs" to fill in the ' +
            "missing data (the automated options should be quite reliable).",
        ),
      });
    }

    if (
      (versionMatch === "*" || versionMatch?.endsWith?.("+prefer")) &&
      installMode === "clone"
    ) {
      res.push({
        type: "replicate-fuzzy-version",
        summary: t('"Replicate" requires "Exact only" as the version'),
        message: t(
          '"Replicate" install can only be used when installing ' +
            "a specific version of a mod. This will definitively break " +
            "as soon as the mod gets updated.",
        ),
      });
    }
    if (versionMatch === "*" && installMode === "choices") {
      res.push({
        type: "choices-fuzzy-version",
        summary: t(
          '"Same Installer Options" should not be used with "Latest" version',
        ),
        message: t(
          'Installing with "Same choices options" may break if the mod gets updated, ' +
            'you may want to switch to "Prefer exact" to be safe.',
        ),
      });
    }

    if (
      sourceType === "bundle" &&
      (versionMatch === "*" || versionMatch?.endsWith?.("+prefer"))
    ) {
      res.push({
        type: "bundled-fuzzy-version",
        summary: t('Version choice has no effect on "Bundled" mod'),
        message: t(
          "If you bundle a mod the user gets exactly the version of the mod you " +
            "have, the Version selection is pointless in this case.",
        ),
      });
    } else if (["browse", "direct"].includes(sourceType)) {
      if (versionMatch?.endsWith?.("+prefer")) {
        res.push({
          type: "web-fuzzy-version",
          summary: t(
            "Version choice has no effect on mods using generic download.",
          ),
          message: t(
            'The option to "prefer exact version" only works with sources that ' +
              "support mod updates (Nexus Mods). For other sources your options " +
              "are to use the exact same version you have locally or to accept whatever " +
              "version the user downloads.",
          ),
        });
      }

      if (!source.url) {
        res.push({
          type: "web-url-missing",
          summary: t("No URL set"),
          message: t(
            'The sources "Browse a website" and "Direct download" require that ' +
              "you provide a URL to download from.",
          ),
        });
      }
    }

    if (saveEdits) {
      if (versionMatch === "*" || versionMatch?.endsWith?.("+prefer")) {
        res.push({
          type: "local-edits-fuzzy-version",
          summary: t("Version choice incompatible with saving local edits."),
          message: t(
            "Local edits can only be applied if the user gets the exact same files " +
              "as you have installed locally, meaning they have to use the exact " +
              "same version of the mod.",
          ),
        });
      }

      if (sourceType === "bundle") {
        res.push({
          type: "local-edits-bundle",
          summary: t(
            "Combining the option to save edits and bundling makes no sense.",
          ),
          message: t(
            'The option to "bundle" already bundles the edited files, storing ' +
              "the edits separately would not be useful as they can't and " +
              "don't have to be applied.",
          ),
        });
      }

      if (installMode === "clone") {
        res.push({
          type: "replicate-vs-binpatch",
          summary: t(
            '"Replicate" installation can\'t be combined with "Binary patching"',
          ),
          message: t(
            '"Replicate" depends on files being unchanged ' +
              "from the originals in the archive. If you modified mod files " +
              '(as Binary Patching implies), "Replicate" will fail.',
          ),
        });
      }
    }

    if (sourceType === "bundle") {
      res.push({
        type: "bundle-copyright",
        summary: t("Only bundle mods you have the right to do so"),
        message: t(
          "Mods are copyright protected, only pack mods if you are sure you " +
            "have the right to do so, e.g. if it's dynamically generated content " +
            "or if it's your own mod.",
        ),
      });
    } else if (sourceType === "direct") {
      res.push({
        type: "direct-download",
        summary: t(
          "Please verify you are allowed to do direct download on this site",
        ),
        message: t(
          "Most websites don't allow direct downloads, Plese make sure you are " +
            "allowed to use direct links to the specified page.",
        ),
      });
    }

    if (
      installMode === "choices" &&
      (entry.mod.attributes?.installerChoices?.options ?? []).length === 0
    ) {
      res.push({
        type: "installer-choices-not-saved",
        summary: t("No Installer Options saved for this mod"),
        message: t(
          "The installer choices for this mod haven't been saved. " +
            "This currently only works with xml-based fomods installed with " +
            "Vortex 1.5.0 or later. " +
            "You may have to reinstall the mod for this to work.",
        ),
      });
    }

    if (versionMatch === "") {
      res.push({
        type: "no-version-set",
        summary: t("No version set for this mod"),
        message: t(
          "The mod has no version number set. This isn't strictly necessary, we use the " +
            "file id to identify the exact version but for the purpose of informing the " +
            "user it would be nicer if a version was specified. " +
            "(Please don't forget to update the collection)",
        ),
      });
    }

    return res;
  }

  private async fixInvalidIds(api: types.IExtensionApi, mod: types.IMod) {
    const modName = util.renderModName(mod);

    const result = await api.showDialog(
      "question",
      modName,
      {
        text:
          "You have to either fix the IDs for this mod or change how the collection " +
          "acquires this mod.",
      },
      [{ label: "Change Source" }, { label: "Fix IDs" }],
    );

    if (result.action === "Fix IDs") {
      api.events.emit("show-main-page", "Mods");
      setTimeout(() => {
        api.events.emit("mods-select-item", mod.id, true);
        api.highlightControl(`.table-detail-modSource`, 4000);
        api.highlightControl(`.table-detail-nexusModId`, 4000);
      }, 200);
    } else {
      (api.highlightControl as any)(
        `#${util.sanitizeCSSId(mod.id)} > .cell-source`,
        4000,
        undefined,
        true,
      );
      (api.highlightControl as any)(
        `#${util.sanitizeCSSId(mod.id)} > .cell-edit-source`,
        4000,
        undefined,
        true,
      );
    }
  }

  private async fixMissingVersion(api: types.IExtensionApi, mod: types.IMod) {
    api.events.emit("show-main-page", "Mods");
    setTimeout(() => {
      api.events.emit("mods-select-item", mod.id, true);
      api.highlightControl(`.table-detail-versionDetail`, 4000);
    }, 200);
  }

  private setCurrentVersion(entry: IModEntry) {
    this.props.onRemoveRule(entry.rule);
    const newRule = _.cloneDeep(entry.rule);
    newRule.reference.versionMatch = entry.mod.attributes["version"];
    this.props.onAddRule(newRule);
  }

  private setPreferVersion(entry: IModEntry) {
    this.props.onRemoveRule(entry.rule);
    const newRule = _.cloneDeep(entry.rule);
    newRule.reference.versionMatch =
      ">=" + safeCoerce(entry.mod.attributes["version"]) + "+prefer";
    this.props.onAddRule(newRule);
  }

  private setPhase = (mod: IModEntry, phase: number) => {
    const {
      onAddRule,
      onDismissPhaseUsage,
      onShowPhaseColumn,
      showPhaseUsage,
    } = this.props;

    const impl = async () => {
      const newRule = _.cloneDeep(mod.rule);
      // onRemoveRule(mod.rule);
      util.setdefault(newRule, "extra", {})["phase"] = phase;
      onAddRule(newRule);

      if (phase !== 0) {
        onShowPhaseColumn();
      }

      if (showPhaseUsage) {
        const result = await this.context.api.showDialog(
          "info",
          "Installation Phase",
          {
            text:
              "When installing your collection Vortex will process installation phases " +
              "one by one and ensure all mods from a given phase are both " +
              "installed and deployed before continuing to the next phase. " +
              "That way, mods that require other mods being present can be set to " +
              "install after their requirements by being put in different phases.\n" +
              "Please note that Vortex will need to deploy after each phase which will " +
              "slow down the installation process. " +
              "It is advised to only utilise this feature when necessary.",
            checkboxes: [
              {
                id: "dismiss",
                text: "Don't show this in the future",
                value: false,
              },
            ],
          },
          [{ label: "Understood" }],
        );
        if (result.input["dismiss"]) {
          onDismissPhaseUsage();
        }
      }
    };

    impl();
  };

  private showProblems = (evt: React.MouseEvent<any>) => {
    const { t, mods } = this.props;

    const modId = evt.currentTarget.getAttribute("data-modid");

    const mod = mods[modId];
    const problems = this.state.problems[modId];

    const { api } = this.context;

    const solutions: Map<ProblemType, () => void> = new Map([
      ["invalid-ids", () => this.fixInvalidIds(api, mod)],
      ["no-version-set", () => this.fixMissingVersion(api, mod)],
      [
        "replicate-fuzzy-version",
        () => this.setCurrentVersion(this.state.entries[modId]),
      ],
      [
        "choices-fuzzy-version",
        () => this.setPreferVersion(this.state.entries[modId]),
      ],
    ]);

    const modName = util.renderModName(mod);
    api.showDialog(
      "info",
      modName,
      {
        bbcode:
          "[list]" +
          problems
            .map((prob: IProblem, idx: number) => {
              if (solutions.has(prob.type)) {
                return `[*]${prob.message} [url="cb://selectproblem/${idx}"]${t("Fix it")}[/url][/*]`;
              } else {
                return `[*]${prob.message}[/*]`;
              }
            })
            .join("") +
          "[/list]",
        options: {
          translated: true,
          bbcodeContext: {
            callbacks: {
              selectproblem: (idx: number) => {
                solutions.get(problems[idx].type)();
                api.closeDialog("collection-problem");
              },
            },
          },
        },
      },
      [{ label: "Close" }],
      "collection-problem",
    );
  };

  private querySource(modId: string, type: SourceType) {
    const { collection } = this.props;
    const src: ICollectionSourceInfo = util.getSafe(
      collection,
      ["attributes", "collection", "source", modId],
      { type },
    );
    const input: types.IInput[] = [];

    let text: string;

    if (type === "bundle") {
      text =
        "These files will be bundled with the collection. " +
        "This means they will be distributed alongside the collection and " +
        "released into the public domain.\n\n" +
        "Bundled content should not be used to distribute mods or mod files. " +
        "It is intended to allow curators to include configuration files or " +
        "outputs from automated tools for the convenience of users. " +
        'Any content that would qualify as a "mod" should be uploaded to a ' +
        "Nexus Mods mod page and included in the collection, rather than being bundled.\n\n" +
        "You should only include content that you have permission to share freely. " +
        "Failure to respect the permissions/license of mod authors may result in " +
        "moderation against your account.";
    } else if (["direct", "browse", "manual"].includes(type)) {
      text = "Please provide information the user needs to find the mod";
    }

    if (["direct", "browse"].includes(type)) {
      input.push({ id: "url", type: "url", label: "URL", value: src.url });
    }

    if (["browse", "manual"].includes(type)) {
      input.push({
        id: "instructions",
        type: "text",
        label: "Instructions",
        value: src.instructions,
      });
    }

    if (input.length > 0 || text !== undefined) {
      // query details for direct/browse/manual
      this.context.api
        .showDialog(
          "question",
          "Provide mod metadata",
          {
            text,
            input,
            checkboxes: [
              {
                id: "adult",
                bbcode:
                  "Mod contains adult content. " +
                  `([url=${ADULT_CONTENT_URL}]Adult Content Guidelines[/url])`,
                value: src.adultContent ?? false,
              },
            ],
          },
          [{ label: "Save" }],
        )
        .then((result) => {
          this.props.onSetCollectionAttribute(["source", modId], {
            type,
            url: result.input.url,
            instructions: result.input.instructions,
            adultContent: result.input.adult === true,
          });
        });
    } else {
      this.props.onSetCollectionAttribute(["source", modId], { type });
    }
  }

  private changeInstallMode = (id: string, value: string) => {
    this.props.onSetCollectionAttribute(["installMode", id], value);
  };

  private changeInstructions = (evt: React.MouseEvent<any>) => {
    const { collection, onSetCollectionAttribute } = this.props;
    const modId = evt.currentTarget.getAttribute("data-modid");

    const value =
      collection.attributes?.collection?.instructions?.[modId] ?? "";

    this.context.api
      .showDialog(
        "info",
        "Instructions",
        {
          md:
            "Instructions added to **required mods** will display alongside the mod as it installs.  \n" +
            "Instructions added to **optional mods** will display before the mod installs, the user " +
            "will be given the option to either install or skip the mod.  \n" +
            'All added instructions will be available in the "Instructions" tab on the Collections page.',
          input: [
            {
              label: "Instructions",
              id: "instructions",
              type: "multiline" as any,
              value,
              placeholder: INSTRUCTIONS_PLACEHOLDER,
            },
          ],
        },
        [{ label: "Cancel" }, { label: "Save" }],
        "collection-set-instructions",
      )
      .then((result) => {
        if (result.action === "Save") {
          onSetCollectionAttribute(
            ["instructions", modId],
            result.input["instructions"],
          );
        }
      });
  };

  private onQuerySource = (evt: React.MouseEvent<any>) => {
    const { collection } = this.props;
    const modId = evt.currentTarget.getAttribute("data-modid");
    const type =
      collection.attributes?.collection?.source?.[modId]?.type ?? "nexus";

    return this.querySource(modId, type);
  };
}

export default ModsEditPage;
