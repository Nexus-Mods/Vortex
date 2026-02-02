/* eslint-disable */
import { IBiDirRule } from "../types/IBiDirRule";
import { IConflict } from "../types/IConflict";

import { setConflictDialog, setFileOverrideDialog } from "../actions";

import { RuleChoice } from "../util/getRuleTypes";

import ConflictEditorTips from "./ConflictEditorTips";

import { NAMESPACE } from "../statics";

import memoizeOne from "memoize-one";
import * as React from "react";
import {
  Button,
  FormControl,
  Modal,
  OverlayTrigger,
  Popover,
  Table,
} from "react-bootstrap";
import { withTranslation, WithTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { batch } from "redux-act";
import { ThunkDispatch } from "redux-thunk";
import * as semver from "semver";
import {
  actions as vortexActions,
  ComponentEx,
  EmptyPlaceholder,
  FlexLayout,
  FormInput,
  selectors,
  Spinner,
  tooltip,
  types,
  util,
  VisibilityProxy,
} from "vortex-api";
import { IPathTools } from "./OverrideEditor";

interface IBaseProps {
  pathTool: IPathTools;
}

interface IConnectedProps {
  gameId: string;
  modIds: string[];
  conflicts: { [modId: string]: IConflict[] };
  modRules: IBiDirRule[];
  mods: { [modId: string]: types.IMod };
  discovery: types.IDiscoveryResult;
}

interface IActionProps {
  onClose: () => void;
  onAddRule: (gameId: string, modId: string, rule: any) => void;
  onRemoveRule: (gameId: string, modId: string, rule: any) => void;
  onOverrideDialog: (gameId: string, modId: string) => void;
  onBatchDispatch: (actions: Redux.Action[]) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

type RuleVersion = "any" | "compatible" | "exact";

interface IRuleSpec {
  type: RuleChoice;
  version: RuleVersion;
}

interface IComponentState {
  hideResolved: boolean;
  filterValue: string;
  rules: { [modId: string]: { [refId: string]: IRuleSpec } };
}

function importVersion(match: string): RuleVersion {
  if (match === undefined || match === "*") {
    return "any";
  } else if (match[0] === "^") {
    return "compatible";
  } else {
    return "exact";
  }
}

function getRuleSpec(
  modId: string,
  mods: { [modId: string]: types.IMod },
  conflicts: IConflict[],
): { [modId: string]: IRuleSpec } {
  const res: { [modId: string]: IRuleSpec } = {};

  // paranoia check, mods[modId] should never be undefined
  const modRules = mods[modId] !== undefined ? mods[modId].rules || [] : [];

  (conflicts || []).forEach((conflict) => {
    const existingRule = modRules.find(
      (rule) =>
        ["before", "after", "conflicts"].indexOf(rule.type) !== -1 &&
        util.testModReference(conflict.otherMod, rule.reference),
    );

    res[conflict.otherMod.id] =
      existingRule !== undefined
        ? {
            type: existingRule.type as any,
            version: importVersion(existingRule.reference.versionMatch),
          }
        : { type: undefined, version: "any" };
  });
  return res;
}

function nop() {
  // nop
}

interface IVisibilityProxyWrapProps {
  entry: { id: string; name: string; numConflicts: number };
  content: (
    modId: string,
    name: string,
    ref: React.RefObject<HTMLDivElement>,
  ) => JSX.Element;
  container: HTMLElement;
}

function VisibilityProxyWrap(props: IVisibilityProxyWrapProps) {
  const { container, entry } = props;
  const [visible, setVisibleImpl] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(undefined);

  const setVisible = React.useCallback(
    (newValue: boolean) => {
      if (!newValue && ref.current !== null) {
        setHeight(ref.current.clientHeight);
      }
      setVisibleImpl(newValue);
    },
    [setVisibleImpl, setHeight, ref.current],
  );

  const content = React.useCallback(
    () => props.content(entry.id, entry.name, ref),
    [props.content, entry],
  );

  // placeholder. uses the last actual size if the content was ever rendered or
  // 3 lines of text per conflict which should be an ok estimate
  const placeholder = React.useCallback(
    () => (
      <div
        id={`placeholder-${entry.id}`}
        style={{ height: height ?? `${3 * entry.numConflicts}em` }}
      />
    ),
    [height],
  );

  return (
    <VisibilityProxy
      container={container}
      content={content}
      placeholder={placeholder}
      visible={visible}
      setVisible={setVisible}
    />
  );
}

/**
 * editor displaying mods that conflict with the selected one
 * and offering a quick way to set up rules between them
 *
 * @class ConflictEditor
 * @extends {ComponentEx<IProps, {}>}
 */
class ConflictEditor extends ComponentEx<IProps, IComponentState> {
  private getModEntriesMemo = memoizeOne(this.getModEntries);
  private getFilteredEntriesMemo = memoizeOne(this.getFilteredEntries);
  private mRef = React.createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);
    this.initState({
      rules: {},
      filterValue: "",
      hideResolved: false,
    });
  }

  public componentDidMount() {
    this.refreshRules(this.props);
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (
      this.props.conflicts !== nextProps.conflicts ||
      this.props.gameId !== nextProps.gameId ||
      this.props.modIds !== nextProps.modIds ||
      this.props.modRules !== nextProps.modRules
    ) {
      // find existing rules for these conflicts
      this.refreshRules(nextProps);
    }
  }

  public render(): JSX.Element {
    const { t, modIds, mods, conflicts } = this.props;
    const { filterValue, hideResolved } = this.state;

    let modName = "";

    if (modIds !== undefined) {
      if (modIds.length === 1) {
        modName = util.renderModName(mods[modIds[0]]);
      } else if (modIds.length > 1) {
        modName = t("Multiple");
      }
    }

    const filterInput =
      conflicts !== undefined && modIds?.length > 0 ? (
        <FormInput
          className="conflict-filter-input"
          value={filterValue}
          placeholder={t("Search for a rule...")}
          onChange={this.onFilterChange}
          debounceTimer={100}
          clearable
        />
      ) : null;

    const hasConflicts = !!modIds?.length;
    const hasAppliedFilters = hideResolved || !!filterValue;
    const content =
      conflicts === undefined ? (
        <div className="conflicts-loading">
          <Spinner />
          {t("Conflicts haven't been calculated yet")}
        </div>
      ) : hasConflicts ? (
        this.renderConflicts()
      ) : (
        <EmptyPlaceholder
          icon="conflict"
          text={t("You have no file conflicts. Wow!")}
        />
      );

    const renderButton = (clickFunc: () => void, text: string) =>
      hasAppliedFilters ? (
        <tooltip.Button
          disabled={true}
          onClick={clickFunc}
          tooltip={t("Unavailable when filters are applied")}
        >
          {t(text)}
        </tooltip.Button>
      ) : (
        <Button disabled={!hasConflicts} onClick={clickFunc}>
          {t(text)}
        </Button>
      );

    const tips = <ConflictEditorTips />;
    return (
      <Modal
        id="conflict-editor-dialog"
        show={modIds !== undefined}
        onHide={nop}
      >
        <Modal.Header>
          <FlexLayout type="column">
            <FlexLayout.Fixed
              style={{ justifyContent: "space-between", display: "flex" }}
            >
              <Modal.Title>{modName}</Modal.Title>
              <tooltip.Icon
                id="dialog-info"
                name="dialog-info"
                tooltip={tips}
              />
            </FlexLayout.Fixed>
          </FlexLayout>
        </Modal.Header>
        <Modal.Body>
          {filterInput}
          {content}
        </Modal.Body>
        <Modal.Footer>
          <FlexLayout.Fixed className="conflict-editor-secondary-actions">
            {renderButton(this.clearRules, "Clear Rules")}
            {renderButton(this.useSuggested, "Use Suggestions")}
            <Button disabled={!hasConflicts} onClick={this.toggleHideResolved}>
              {hideResolved ? t("Show Resolved") : t("Hide Resolved")}
            </Button>
          </FlexLayout.Fixed>
          <FlexLayout.Fixed className="conflict-editor-main-actions">
            <Button onClick={this.close}>{t("Cancel")}</Button>
            <Button onClick={this.save}>{t("Save")}</Button>
          </FlexLayout.Fixed>
        </Modal.Footer>
      </Modal>
    );
  }

  private refreshRules = (props: IProps) => {
    this.nextState.rules = (props.modIds || []).reduce(
      (
        prev: { [modId: string]: { [refId: string]: IRuleSpec } },
        modId: string,
      ) => {
        prev[modId] = getRuleSpec(modId, props.mods, props.conflicts?.[modId]);
        return prev;
      },
      {},
    );
  };

  private clearRules = () => {
    const { t, modIds, conflicts } = this.props;
    this.context.api.showDialog(
      "question",
      t("Confirm"),
      {
        text: t(
          'This change will only be applied once you choose to "Save" the change in the main ' +
            "dialogue window. Please be aware that once saved, this action cannot be undone and the " +
            "mod rules and file overrides will have to be set again.",
        ),
      },
      [
        { label: "Cancel", default: true },
        {
          label: "Clear Rules",
          action: () => {
            const batchedActions: Redux.Action[] = [];
            for (const modId of modIds || []) {
              if (Array.isArray(this.props.mods[modId]?.fileOverrides)) {
                batchedActions.push(
                  vortexActions.setFileOverride(this.props.gameId, modId, []),
                );
              }
            }
            if (batchedActions.length > 0) {
              this.props.onBatchDispatch(batchedActions);
            }
            this.nextState.rules = (modIds || []).reduce(
              (
                prev: { [modId: string]: { [refId: string]: IRuleSpec } },
                modId: string,
              ) => {
                const res: { [modId: string]: IRuleSpec } = {};
                (conflicts[modId] || []).forEach((conflict) => {
                  res[conflict.otherMod.id] = {
                    type: undefined,
                    version: "any",
                  };
                });
                prev[modId] = res;
                return prev;
              },
              {},
            );
          },
        },
      ],
    );
  };

  private toggleHideResolved = () => {
    this.nextState.hideResolved = !this.state.hideResolved;
  };

  private useSuggested = () => {
    const { t, mods, modIds, conflicts } = this.props;
    this.context.api.showDialog(
      "question",
      t("Confirm"),
      {
        bbcode: t(
          "Vortex can set some of the rules automatically based on the last modified date. " +
            "Mods with newer files will be loaded after mods with older files, effectively overriding " +
            "older mods. While this is a quick way to resolve mod conflicts with generally decent results, " +
            "it is no guarantee for a working mod load order.[br][/br][br][/br]" +
            "Please note: Vortex will be unable to suggest rules for mods with files " +
            "that are both older than some and newer than others from a conflicting mod.[br][/br][br][/br]" +
            "Loading mods in the incorrect order can lead to in-game errors such as:[br][/br][br][/br]" +
            "[list][*]Mods not having an effect on the game[*]Incorrect textures or models showing up " +
            "[*]The game crashing[/list][br][/br]If you find that your mods don't work correctly " +
            "you can always come here and change their order.",
        ),
      },
      [
        { label: "Cancel", default: true },
        {
          label: "Use Suggested",
          action: () => {
            this.nextState.rules = (modIds || []).reduce(
              (
                prev: { [modId: string]: { [refId: string]: IRuleSpec } },
                modId: string,
              ) => {
                const modRules =
                  mods[modId] !== undefined ? mods[modId].rules || [] : [];

                const res: { [modId: string]: IRuleSpec } = {};
                (conflicts[modId] || []).forEach((conflict) => {
                  const existingRule = modRules.find(
                    (rule) =>
                      ["before", "after", "conflicts"].indexOf(rule.type) !==
                        -1 &&
                      util.testModReference(conflict.otherMod, rule.reference),
                  );

                  const reverseSuggestion =
                    conflict.suggestion !== null
                      ? conflict.suggestion === "after"
                        ? "before"
                        : "after"
                      : undefined;

                  if (
                    prev[conflict.otherMod.id]?.[modId]?.type ===
                    reverseSuggestion
                  ) {
                    // This rule is already set on the other mod.
                    res[conflict.otherMod.id] = {
                      type: undefined,
                      version: "any",
                    };
                  } else {
                    res[conflict.otherMod.id] =
                      conflict.suggestion !== null
                        ? {
                            type: conflict.suggestion,
                            version:
                              existingRule !== undefined
                                ? importVersion(
                                    existingRule.reference.versionMatch,
                                  )
                                : "any",
                          }
                        : existingRule !== undefined
                          ? {
                              type: existingRule.type as any,
                              version: importVersion(
                                existingRule.reference.versionMatch,
                              ),
                            }
                          : { type: undefined, version: "any" };
                  }
                });
                prev[modId] = res;
                return prev;
              },
              {},
            );
          },
        },
      ],
    );
  };

  private onFilterChange = (input) => {
    this.nextState.filterValue = input;
  };

  private isUnresolved = (
    mods: { [modId: string]: types.IMod },
    modId: string,
    otherModId: string,
    rules: { [modId: string]: { [refId: string]: IRuleSpec } },
    hideResolved: boolean,
  ) => {
    const isRuleSet: boolean =
      rules[otherModId]?.[modId] === undefined
        ? (mods[otherModId]?.rules ?? []).find(
            (rule) =>
              ["before", "after", "conflicts"].includes(rule.type) &&
              util.testModReference(mods[modId], rule.reference),
          ) !== undefined
        : rules[otherModId][modId].type !== undefined;

    return hideResolved
      ? rules[modId][otherModId] === undefined
        ? !isRuleSet
        : rules[modId][otherModId].type === undefined && !isRuleSet
      : true;
  };

  private applyFilter = (
    conflict: IConflict,
    mods: { [modId: string]: types.IMod },
    modId: string,
    filterValue: string,
    rules: { [modId: string]: { [refId: string]: IRuleSpec } },
    hideResolved: boolean,
  ): boolean => {
    if (!filterValue && !hideResolved) {
      return true;
    }

    if (mods[conflict.otherMod.id] === undefined) {
      return false;
    }

    const isMatch = (val: string) =>
      val.toLowerCase().includes(filterValue.toLowerCase());
    const modName: string = util.renderModName(mods[modId]);
    const otherModName: string = util.renderModName(mods[conflict.otherMod.id]);
    const testFilterMatch = () =>
      filterValue ? isMatch(modName) || isMatch(otherModName) : true;

    return (
      testFilterMatch() &&
      this.isUnresolved(mods, modId, conflict.otherMod.id, rules, hideResolved)
    );
  };

  private getFilteredEntries(
    modEntries: Array<{ id: string }>,
    mods: { [modId: string]: types.IMod },
    conflicts: { [modId: string]: IConflict[] },
    filterValue: string,
    rules: { [modId: string]: { [refId: string]: IRuleSpec } },
    hideResolved: boolean,
  ): { [modId: string]: IConflict[] } {
    return modEntries.reduce((prev, entry) => {
      prev[entry.id] = (conflicts[entry.id] || []).filter((conflict) =>
        this.applyFilter(
          conflict,
          mods,
          entry.id,
          filterValue,
          rules,
          hideResolved,
        ),
      );
      return prev;
    }, {});
  }

  private getModEntries(
    mods: { [modId: string]: types.IMod },
    conflicts: { [modId: string]: IConflict[] },
    modIds: string[],
  ) {
    return (modIds || [])
      .map((modId) => ({
        id: modId,
        name: util.renderModName(mods[modId], { version: true }),
        numConflicts: (conflicts[modId] ?? []).length,
      }))
      .filter((mod) => mod.name !== undefined)
      .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
  }

  private renderConflicts = (): JSX.Element => {
    const { t, conflicts, mods, modIds } = this.props;
    const { filterValue, rules, hideResolved } = this.state;

    const modEntries = this.getModEntriesMemo(mods, conflicts, modIds);
    const filteredEntries = this.getFilteredEntriesMemo(
      modEntries,
      mods,
      conflicts,
      filterValue,
      rules,
      hideResolved,
    );

    const filteredConflictsCount = Object.values(filteredEntries).reduce(
      (prev: number, entry) => (prev += entry.length),
      0,
    );

    const renderPlaceholder = () =>
      modEntries.length > 0 && filteredConflictsCount === 0 ? (
        <EmptyPlaceholder
          icon="conflict"
          text={t("Filters are applied")}
          subtext={t("Please remove applied filters to view all conflicts")}
        />
      ) : null;

    const renderModEntry = (
      modId: string,
      name: string,
      ref: React.RefObject<HTMLDivElement>,
    ) => {
      const filtered = filteredEntries[modId];
      return filtered.length > 0 ? (
        <div
          id={`content-${modId}`}
          key={`mod-conflict-element-${modId}`}
          ref={ref}
        >
          <div className="mod-conflict-group-header">
            <label>{util.renderModName(mods[modId])}</label>
            <a
              data-modid={modId}
              data-action="before_all"
              onClick={this.applyGroupRule}
            >
              {t("Before All")}
            </a>
            <span className="link-action-seperator">&nbsp; | &nbsp;</span>
            <a
              data-modid={modId}
              data-action="after_all"
              onClick={this.applyGroupRule}
            >
              {t("After All")}
            </a>
          </div>
          <Table className="mod-conflict-list">
            <tbody>
              {filtered.map((conf: IConflict) =>
                this.renderConflict(modId, name, conf),
              )}
            </tbody>
          </Table>
        </div>
      ) : null;
    };

    return modEntries.length > 0 ? (
      <div ref={this.mRef}>
        {modEntries.map((entry) => (
          <VisibilityProxyWrap
            key={entry.id}
            container={this.mRef.current}
            entry={entry}
            content={renderModEntry}
          />
        ))}
        {renderPlaceholder()}
      </div>
    ) : null;
  };

  private confirmGroupRule = (
    modId: string,
    refIds: string[],
    apply: () => void,
  ) => {
    const { t } = this.props;
    this.context.api.showDialog(
      "question",
      t("Confirm"),
      {
        bbcode: t(
          "You are about to apply a group rule (before/after all), to the following " +
            "mods: [br][/br][br][/br]{{mods}}[br][/br][br][/br]",
          { replace: { mods: [modId].concat(refIds).join("[br][/br]") } },
        ),
      },
      [
        { label: "Cancel", default: true },
        {
          label: "Apply Rule",
          action: () => apply(),
        },
      ],
    );
  };

  private applyGroupRule = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    const { conflicts, mods } = this.props;
    const { rules, hideResolved, filterValue } = this.state;
    const action = evt.currentTarget.getAttribute("data-action");
    const modId = evt.currentTarget.getAttribute("data-modid");
    if (
      ["after_all", "before_all"].indexOf(action) === -1 ||
      conflicts === undefined
    ) {
      return;
    }

    let newRules = { ...rules };
    const hasAppliedFilters = hideResolved || !!filterValue;
    const refIds = hasAppliedFilters
      ? Object.keys(rules[modId]).filter((refId) => {
          if (mods[refId] === undefined) {
            return false;
          }
          const modName = util.renderModName(mods[refId]);
          let matchesFilter = false;
          if (modName !== undefined) {
            const refModName = modName.toLowerCase();
            matchesFilter = refModName.includes(filterValue.toLowerCase());
          }
          return (
            (!!filterValue && matchesFilter) ||
            (hideResolved &&
              this.isUnresolved(mods, modId, refId, rules, hideResolved))
          );
        })
      : Object.keys(rules[modId]);
    const unassignedRefIds = refIds.filter((refId) => {
      const currentModRule = rules[modId]?.[refId]?.type;
      const currentRefRule = rules[refId]?.[modId]?.type;
      const hasRule = (rule: RuleChoice) => rule !== undefined;
      return !hasRule(currentModRule) && !hasRule(currentRefRule);
    });

    const removeRefRule = (refId: string) =>
      rules[refId]?.[modId] === undefined
        ? (newRules = {
            ...newRules,
            [refId]: {
              [modId]: {
                version: "any",
                type: undefined,
              },
            },
          })
        : (newRules[refId][modId] = {
            version: "any",
            type: undefined,
          });

    const applyRule = () => {
      const refrencedModIds =
        unassignedRefIds.length > 0 ? unassignedRefIds : refIds;
      refrencedModIds.forEach((refId) => {
        // Remove any existing rules from the referenced modIds.
        const refRules = getRuleSpec(refId, mods, conflicts[refId]);
        if (
          refRules?.[modId]?.type !== undefined ||
          rules[refId]?.[modId]?.type !== undefined
        ) {
          removeRefRule(refId);
        }

        newRules[modId][refId] = {
          ...newRules[modId][refId],
          type: action === "before_all" ? "before" : "after",
        };
      });
      this.nextState.rules = newRules;
    };
    if (unassignedRefIds.length > 0) {
      applyRule();
    } else {
      this.confirmGroupRule(modId, refIds, applyRule);
    }
  };

  private renderConflict = (
    modId: string,
    name: string,
    conflict: IConflict,
  ) => {
    const { t, modRules, mods, pathTool, discovery } = this.props;
    const { rules } = this.state;

    if (
      discovery?.path === undefined ||
      mods[modId] === undefined ||
      rules[modId] === undefined ||
      mods[conflict.otherMod.id] === undefined
    ) {
      return null;
    }

    const toRelPath = (lhs: string, rhs: string) => pathTool.relative(lhs, rhs);
    const popover = (
      <Popover
        className="conflict-popover"
        id={`conflict-popover-${conflict.otherMod.id}`}
      >
        {conflict.files
          .slice(0)
          .sort()
          .map((fileName) => (
            <p key={fileName}>{toRelPath(discovery.path, fileName)}</p>
          ))}
        <Button data-modid={modId} onClick={this.openOverrideDialog}>
          {t("Edit individual files")}
        </Button>
      </Popover>
    );

    const rule = rules[modId][conflict.otherMod.id] ?? {
      type: undefined,
      version: "any",
    };

    let reverseRule: IBiDirRule;

    if (rule.type === undefined) {
      // no rule on this to solve the conflict but maybe there is one the other way around?
      const refId = conflict.otherMod.id;

      if (rules[refId] !== undefined) {
        // this path is taken in the case where the dialog shows the rules for both mods.
        // since the rules for the other mod might be changed, we have to use the unsaved state
        const reverseMod =
          rules[refId]?.[modId] !== undefined &&
          ["before", "after"].indexOf(rules[refId]?.[modId]?.type) !== -1;

        if (reverseMod) {
          reverseRule = {
            source: { id: modId },
            reference: { id: refId },
            original: false,
            type: rules[refId][modId].type === "before" ? "after" : "before",
          };
        }
      } else {
        // if the dialog shows only the rules for the one mod, the reverse rules are taken
        // from modRules because rules doesn't contain them and we they can't get changed in
        // this dialog anyway
        reverseRule = modRules.find(
          (iter) =>
            !iter.original &&
            util.testModReference(conflict.otherMod, iter.reference) &&
            util.testModReference(mods[modId], iter.source),
        );
      }
    }

    return (
      <tr key={JSON.stringify(conflict)}>
        <td style={{ width: "8em" }}>{t("Load")}</td>
        <td className="conflict-rule-owner">
          <div>{name}</div>
        </td>
        <td>
          <FormControl
            className="conflict-rule-select"
            componentClass="select"
            value={rule?.type || reverseRule?.type || "norule"}
            onChange={this.setRuleType}
            data-modid={modId}
            data-refid={conflict.otherMod.id}
            disabled={reverseRule !== undefined}
          >
            <option value="norule">???</option>
            <option value="before">
              {conflict.suggestion === "before"
                ? t("before (suggested)")
                : t("before")}
            </option>
            <option value="after">
              {conflict.suggestion === "after"
                ? t("after (suggested)")
                : t("after")}
            </option>
            <option value="conflicts">{t("never together with")}</option>
          </FormControl>
        </td>
        <td className="conflict-rule-description">
          <div className="conflict-rule-reference">
            <div className="conflict-rule-name">
              <div>
                {util.renderModName(mods[conflict.otherMod.id], {
                  version: true,
                })}
              </div>
              <OverlayTrigger
                trigger="click"
                rootClose
                placement="right"
                overlay={popover}
              >
                <a>
                  {t("{{ count }} conflicting file", {
                    count: conflict.files.length,
                    ns: "dependency-manager",
                  })}
                </a>
              </OverlayTrigger>
            </div>
          </div>
        </td>
        <td>
          <FormControl
            componentClass="select"
            value={rule?.version ?? "any"}
            onChange={this.setRuleVersion}
            data-modid={modId}
            data-refid={conflict.otherMod.id}
            className="conflict-rule-version"
            disabled={reverseRule !== undefined}
          >
            <option value="any">{t("Any version")}</option>
            {conflict.otherMod.version &&
            semver.valid(conflict.otherMod.version) ? (
              <option value="compatible">{t("Compatible version")}</option>
            ) : null}
            {conflict.otherMod.version ? (
              <option value="exact">{t("Only this version")}</option>
            ) : null}
          </FormControl>
        </td>
        <td style={{ width: "5em" }}>
          {this.renderReverseRule(modId, reverseRule)}
        </td>
      </tr>
    );
  };

  private renderReverseRule(modId: string, rule: IBiDirRule) {
    const { t, mods } = this.props;
    if (rule === undefined) {
      return null;
    }

    const tip = (
      <div>
        {t("{{ otherMod }} has a rule referencing {{ thisMod }}", {
          replace: {
            otherMod: util.renderModReference(
              rule.reference,
              mods[rule.reference.id],
            ),
            thisMod: util.renderModReference(rule.source, mods[rule.source.id]),
          },
        })}
      </div>
    );

    return (
      <tooltip.IconButton
        id={`conflict-editor-${rule.reference.fileMD5}`}
        className="conflict-editor-reverserule pull-right"
        icon="locked"
        tooltip={tip}
        data-modid={modId}
        data-rule={JSON.stringify(rule)}
        onClick={this.unlock}
      />
    );
  }

  private unlock = (evt: React.MouseEvent<HTMLDivElement>) => {
    const { t, gameId, mods, onRemoveRule } = this.props;
    const modId = evt.currentTarget.getAttribute("data-modid");
    const rule = JSON.parse(evt.currentTarget.getAttribute("data-rule"));
    // rule is the "reverse" rule, we need the original.

    const reverseType = rule.type === "before" ? "after" : "before";

    const findRule = (iter) =>
      iter.type === reverseType &&
      util.testModReference(mods[modId], iter.reference);

    const refMod: types.IMod = Object.keys(mods)
      .map((iter) => mods[iter])
      .find(
        (iter) =>
          util.testModReference(iter, rule.reference) &&
          iter.rules !== undefined &&
          iter.rules.find(findRule) !== undefined,
      );

    if (refMod === undefined) {
      // paranoia check, this should not be possible. The only way it could happen if, due to a
      // failed update we have the "reverse" rule but the original is gone.
      return;
    }

    const originalRule = refMod.rules.find(findRule);

    this.context.api.showDialog(
      "question",
      t("Confirm"),
      {
        text: t(
          "This will remove the existing rule so you can set a new one on this mod.",
        ),
      },
      [
        { label: "Cancel" },
        {
          label: "Remove Rule",
          default: true,
          action: () => {
            onRemoveRule(gameId, refMod.id, {
              type: originalRule.type,
              reference: originalRule.reference,
            });
          },
        },
      ],
    );
  };

  private close = () => {
    const { onClose } = this.props;
    this.nextState.filterValue = "";
    this.nextState.hideResolved = false;
    onClose();
  };

  private setRuleType = (evt: React.MouseEvent<any>) => {
    const modId = evt.currentTarget.getAttribute("data-modid");
    const refId = evt.currentTarget.getAttribute("data-refid");
    if (this.nextState.rules[modId][refId] !== undefined) {
      this.nextState.rules[modId][refId].type =
        evt.currentTarget.value === "norule"
          ? undefined
          : evt.currentTarget.value;
    }
  };

  private setRuleVersion = (evt: React.MouseEvent<any>) => {
    const modId = evt.currentTarget.getAttribute("data-modid");
    const refId = evt.currentTarget.getAttribute("data-refid");
    if (this.nextState.rules[modId][refId] !== undefined) {
      this.nextState.rules[modId][refId].version = evt.currentTarget.value;
    }
  };

  private translateModVersion(mod: types.IMod, spe: RuleVersion) {
    if (spe === "any" || mod.attributes === undefined) {
      return "*";
    } else if (spe === "compatible") {
      return "^" + mod.attributes.version;
    } else {
      return mod.attributes.version;
    }
  }

  private openOverrideDialog = (evt: React.MouseEvent<any>) => {
    const { gameId, onOverrideDialog } = this.props;
    const modId = evt.currentTarget.getAttribute("data-modid");
    onOverrideDialog(gameId, modId);
    document.body.click();
  };

  private save = () => {
    const { gameId, mods, onBatchDispatch } = this.props;
    const { rules } = this.state;

    const actions: Redux.Action[] = [];

    Object.keys(rules).forEach((modId) => {
      if (mods[modId] === undefined) {
        return;
      }
      Object.keys(rules[modId]).forEach((otherId) => {
        if (mods[otherId] === undefined) {
          return;
        }
        const origRule = (mods[modId].rules || []).find(
          (rule) =>
            ["before", "after", "conflicts"].indexOf(rule.type) !== -1 &&
            (util as any).testModReference(mods[otherId], rule.reference),
        );

        if (origRule !== undefined) {
          actions.push(vortexActions.removeModRule(gameId, modId, origRule));
        }

        if (rules[modId][otherId].type !== undefined) {
          actions.push(
            vortexActions.addModRule(gameId, modId, {
              reference: {
                id: otherId,
                versionMatch: this.translateModVersion(
                  mods[otherId],
                  rules[modId][otherId].version,
                ),
              },
              type: rules[modId][otherId].type,
            }),
          );
        }
      });
    });
    onBatchDispatch(actions);

    this.close();
  };
}

const emptyObj = {};

function mapStateToProps(state): IConnectedProps {
  const dialog = state.session.dependencies.conflictDialog || emptyObj;
  const discovery =
    dialog?.gameId !== undefined
      ? selectors.discoveryByGame(state, dialog.gameId)
      : emptyObj;
  return {
    gameId: dialog.gameId,
    modIds: dialog.modIds,
    conflicts: util.getSafe(
      state,
      ["session", "dependencies", "conflicts"],
      undefined,
    ),
    mods:
      dialog.gameId !== undefined
        ? state.persistent.mods[dialog.gameId]
        : emptyObj,
    modRules: dialog.modRules,
    discovery,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onClose: () => dispatch(setConflictDialog(undefined, undefined, undefined)),
    onAddRule: (gameId, modId, rule) =>
      dispatch(vortexActions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId, modId, rule) =>
      dispatch(vortexActions.removeModRule(gameId, modId, rule)),
    onOverrideDialog: (gameId: string, modId: string) =>
      dispatch(setFileOverrideDialog(gameId, modId)),
    onBatchDispatch: (actions: Redux.Action[]) => dispatch(batch(actions)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(ConflictEditor) as any,
) as React.ComponentClass<{}>;
