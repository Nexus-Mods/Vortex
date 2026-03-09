import { IBiDirRule } from "../types/IBiDirRule";
import { IConflict } from "../types/IConflict";
import { IModLookupInfo } from "../types/IModLookupInfo";

import ruleFulfilled from "../util/ruleFulfilled";

import {
  setConflictDialog,
  setCreateRule,
  setFileOverrideDialog,
  setSource,
  setTarget,
} from "../actions";

import { enabledModKeys } from "../selectors";

import I18next from "i18next";
import * as _ from "lodash";
import memoizeOne from "memoize-one";
import {
  ILookupResult,
  IModInfo,
  IReference,
  IRule,
  RuleType,
} from "modmeta-db";
import * as React from "react";
import { Overlay, Popover } from "react-bootstrap";
import {
  ConnectDragPreview,
  ConnectDragSource,
  ConnectDropTarget,
  DragSource,
  DragSourceConnector,
  DragSourceMonitor,
  DragSourceSpec,
  DropTarget,
  DropTargetConnector,
  DropTargetMonitor,
  DropTargetSpec,
} from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { findDOMNode } from "react-dom";
import { connect } from "react-redux";
import * as semver from "semver";
import {
  actions,
  ComponentEx,
  log,
  selectors,
  tooltip,
  types,
  util,
} from "vortex-api";

interface IDescriptionProps {
  t: typeof I18next.t;
  rule: IRule;
  key: string;
  onRemoveRule?: (rule: IRule) => void;
  fulfilled: boolean;
  mod: types.IMod;
}

const emptyArray = [];

class RuleDescription extends React.Component<IDescriptionProps, {}> {
  public render(): JSX.Element {
    const { rule } = this.props;

    const classes = ["rule-description", this.className()]
      .filter((iter) => iter !== undefined)
      .join(" ");
    const key = this.key(rule);
    return (
      <div key={key} className={classes}>
        {this.renderType(rule.type)} {this.renderReference(rule.reference)}
        {this.renderRemove()}
      </div>
    );
  }

  private className() {
    const { fulfilled, rule } = this.props;
    if (fulfilled === null) {
      return undefined;
    } else if (rule["ignored"] === true) {
      return "rule-ignored";
    } else if (fulfilled) {
      return "rule-fulfilled";
    } else {
      return "rule-unfulfilled";
    }
  }

  private key(rule: any) {
    return (
      rule.type +
      "_" +
      (rule.reference.logicalFileName ||
        rule.reference.fileExpression ||
        rule.reference.fileMD5 ||
        rule.reference.id)
    );
  }

  private renderRemove = () => {
    const { t, onRemoveRule, rule } = this.props;

    if (onRemoveRule === undefined) {
      return null;
    }

    return (
      <tooltip.IconButton
        id={this.key(rule)}
        className="btn-embed"
        icon="remove"
        tooltip={t("Remove")}
        onClick={this.removeThis}
      />
    );
  };

  private removeThis = () => {
    this.props.onRemoveRule(this.props.rule);
  };

  private renderType = (ruleType: RuleType): JSX.Element => {
    const { t } = this.props;
    let renderString: string;
    switch (ruleType) {
      case "before":
        renderString = t("Loads before");
        break;
      case "after":
        renderString = t("Loads after");
        break;
      case "requires":
        renderString = t("Requires");
        break;
      case "recommends":
        renderString = t("Recommends");
        break;
      case "conflicts":
        renderString = t("Conflicts with");
        break;
      case "provides":
        renderString = t("Provides");
        break;
      default:
        throw new Error("invalid rule type " + ruleType);
    }
    return <p style={{ display: "inline" }}>{renderString}</p>;
  };

  private renderReference = (ref: any): JSX.Element => {
    const { mod } = this.props;

    if (mod !== undefined) {
      return (
        <p className="rule-mod-name">
          {util.renderModName(mod, { version: true })}
        </p>
      );
    }

    let version = "*";
    if (ref.versionMatch !== undefined) {
      try {
        const sv = new semver.Range(ref.versionMatch, {
          loose: true,
          includePrerelease: true,
        });
        version = sv.range;
      } catch (err) {
        version = ref.versionMatch;
      }
    }

    if (ref.description !== undefined) {
      return (
        <p className="rule-mod-name">
          {ref.description} {version}
        </p>
      );
    }

    if (ref.logicalFileName === undefined && ref.fileExpression === undefined) {
      return <p className="rule-mod-name">{ref.fileMD5 || ref.id}</p>;
    }

    return (
      <p className="rule-mod-name">
        {ref.logicalFileName || ref.fileExpression} {version}
      </p>
    );
  };
}

export interface ILocalState {
  modRules: IBiDirRule[];
}

export interface IBaseProps {
  t: typeof I18next.t;
  mod: types.IMod;
  localState: ILocalState;
  onHighlight: (highlight: boolean) => void;
}

interface IConnectedProps {
  gameId: string;
  conflicts: { [modId: string]: IConflict[] };
  enabledMods: IModLookupInfo[];
  source: { id: string; pos: any };
  highlightConflict: boolean;
  mods: { [modId: string]: types.IMod };
  modState: { [id: string]: any };
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number; y: number }) => void;
  onSetTarget: (id: string, pos: { x: number; y: number }) => void;
  onEditDialog: (
    gameId: string,
    modId: string,
    reference: IReference,
    defaultType: string,
  ) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IRule) => void;
  onConflictDialog: (
    gameId: string,
    modIds: string[],
    modRules: IBiDirRule[],
  ) => void;
  onOverrideDialog: (gameId: string, modId: string) => void;
}

interface IComponentState {
  reference: IReference;
  modInfo: IModInfo;
  showOverlay: boolean;
  modRules: IBiDirRule[];
}

interface IDragProps {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
  isDragging: boolean;
}

interface IDropProps {
  connectDropTarget: ConnectDropTarget;
  isOver: boolean;
  canDrop: boolean;
}

type IProps = IBaseProps &
  IConnectedProps &
  IActionProps &
  IDragProps &
  IDropProps;

function componentCenter(component: React.Component<any, any>) {
  const box = (findDOMNode(component) as Element).getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

// what a hack... :(
// react-dnd seems to completely block the mousemove event so the monitor seems to be
// the only way to get at the cursor position. It doesn't fire events on movement though
let cursorPosUpdater: NodeJS.Timeout;
let lastUpdatePos: { x: number; y: number } = { x: 0, y: 0 };
function updateCursorPos(
  monitor: DragSourceMonitor,
  component: React.Component<any, any>,
  onSetSource: (id: string, pos: { x: number; y: number }) => void,
  onSetTarget: (id: string, pos: { x: number; y: number }) => void,
) {
  if (monitor.getClientOffset() !== null) {
    const curPos = monitor.getClientOffset();
    const dist =
      Math.abs(curPos.x - lastUpdatePos.x) +
      Math.abs(curPos.y - lastUpdatePos.y);
    if (dist > 2 && monitor.getItem() !== null) {
      const sourceId = (monitor.getItem() as any).id;
      lastUpdatePos = curPos;
      onSetTarget(null, curPos);
      try {
        onSetSource(sourceId, componentCenter(component));
      } catch (err) {
        // TODO: this is actually ok atm. The only thing that can throw is the call to findDOMNode
        //   in componentCenter which will happen if the component is off-screen and outside the
        //   scroll window.
        //   In this case just leave the source where it was, which should be just outside the
        //   table
      }
    }
  }
  cursorPosUpdater = setTimeout(
    () => updateCursorPos(monitor, component, onSetSource, onSetTarget),
    50,
  );
}

const dependencySource: DragSourceSpec<IProps, any> = {
  beginDrag(props: IProps, monitor: DragSourceMonitor, component) {
    updateCursorPos(monitor, component, props.onSetSource, props.onSetTarget);
    return {
      id: props.mod.id,
    };
  },
  endDrag(props: IProps, monitor: DragSourceMonitor) {
    clearTimeout(cursorPosUpdater);
    cursorPosUpdater = undefined;

    const sourceId: string = (monitor.getItem() as any).id;
    props.onSetSource(sourceId, undefined);

    if (monitor.getDropResult() === null) {
      return;
    }

    const destId: string = (monitor.getDropResult() as any).id;
    const reference: IReference = (monitor.getDropResult() as any).reference;

    if (sourceId !== destId) {
      props.onEditDialog(props.gameId, sourceId, reference, "after");
    }
  },
};

const dependencyTarget: DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: DropTargetMonitor, component: any) {
    const inst: DependencyIcon = component.decoratedRef.current;
    if (inst === undefined) {
      return undefined;
    }
    return {
      id: props.mod.id,
      reference: inst.state.reference,
    };
  },
};

function collectDrag(
  conn: DragSourceConnector,
  monitor: DragSourceMonitor,
): IDragProps {
  return {
    connectDragSource: conn.dragSource(),
    connectDragPreview: conn.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(
  conn: DropTargetConnector,
  monitor: DropTargetMonitor,
): IDropProps {
  return {
    connectDropTarget: conn.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

class DependencyIcon extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean;
  private mRef: JSX.Element;
  private mRuleFulfillmentMemo = memoizeOne(this.ruleFulfillment);

  constructor(props: IProps) {
    super(props);

    this.initState({
      modInfo: undefined,
      reference: undefined,
      showOverlay: false,
      modRules: props.localState.modRules.filter((rule) =>
        (util.testModReference as any)(props.mod, rule.source),
      ),
    });

    this.mIsMounted = false;
  }

  public UNSAFE_componentWillMount() {
    this.updateMod(this.props.mod);
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.props.connectDragPreview(getEmptyImage() as any);
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.mod !== nextProps.mod) {
      this.updateMod(nextProps.mod);
    }

    if (
      this.props.mod !== nextProps.mod ||
      this.props.localState.modRules !== nextProps.localState.modRules
    ) {
      this.nextState.modRules = nextProps.localState.modRules.filter((rule) =>
        (util.testModReference as any)(nextProps.mod, rule.source),
      );
    }

    if (this.props.isDragging !== nextProps.isDragging) {
      let pos;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.mod.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      let pos;

      if (nextProps.isOver) {
        pos = componentCenter(this);
      }
      nextProps.onHighlight(nextProps.isOver);
      nextProps.onSetTarget(nextProps.mod.id, pos);
    }
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IComponentState) {
    // enabledMods changes whenever any of the mods changes - even if that change
    // is not reflected in the reference stored in enabledMods
    return (
      this.props.conflicts !== nextProps.conflicts ||
      this.props.enabledMods !== nextProps.enabledMods ||
      this.props.gameId !== nextProps.gameId ||
      this.props.mod !== nextProps.mod ||
      this.props.localState.modRules !== nextProps.localState.modRules ||
      this.props.source !== nextProps.source ||
      this.props.highlightConflict !== nextProps.highlightConflict ||
      this.state !== nextState
    );
  }

  public render(): JSX.Element {
    const { connectDropTarget, mod, source } = this.props;

    if (mod.state !== "installed") {
      return null;
    }

    const classes = ["dependencies-inner"];

    if (source !== undefined) {
      // while dragging, make this div larger, overflowing into neighboring columns
      // to make it easier to hit
      classes.push("connecting");
    }

    return connectDropTarget(
      <div className={classes.join(" ")}>
        {this.renderConnectorIcon(mod)}
        {this.renderConflictIcon(mod)}
        {this.renderOverrideIcon(mod)}
      </div>,
    );
  }

  private ruleFulfillment(
    staticRules: IRule[],
    customRules: IRule[],
    enabledMods: IModLookupInfo[],
    gameId: string,
    modId: string,
  ): Map<IRule, boolean> {
    const res = new Map<IRule, boolean>();

    const source = { gameId, modId };

    staticRules.forEach((rule) =>
      res.set(rule, ruleFulfilled(enabledMods, rule, source)),
    );
    customRules.forEach((rule) =>
      res.set(rule, ruleFulfilled(enabledMods, rule, source)),
    );

    return res;
  }

  private renderConnectorIcon(mod: types.IMod) {
    const { t, connectDragSource, enabledMods, gameId, modState, mods } =
      this.props;

    const classes = ["btn-dependency"];

    let anyUnfulfilled: boolean = false;

    const staticRules = this.state.modInfo?.rules ?? emptyArray;
    const customRules = mod.rules ?? emptyArray;

    const rulesFulfilled =
      modState?.[mod.id]?.enabled === true
        ? this.mRuleFulfillmentMemo(
            staticRules,
            customRules,
            enabledMods,
            gameId,
            mod.id,
          )
        : null;

    const renderRule = (rule: IRule, onRemove: (rule: IRule) => void) => {
      const isFulfilled =
        rulesFulfilled !== null ? rulesFulfilled.get(rule) : true;

      // isFulfilled could be null
      if (isFulfilled === false && !rule["ignored"]) {
        anyUnfulfilled = true;
      }

      if (mods === undefined) {
        return null;
      }

      const refMod: types.IMod = mods[(rule.reference as any).id];
      return (
        <RuleDescription
          t={t}
          key={this.key(rule)}
          rule={rule}
          onRemoveRule={onRemove}
          fulfilled={isFulfilled}
          mod={refMod}
        />
      );
    };

    let popover: JSX.Element;

    if (staticRules.length > 0 || customRules.length > 0) {
      popover = (
        <Popover id={`popover-${mod.id}`} style={{ maxWidth: 500 }}>
          {staticRules.map((rule) => renderRule(rule, undefined))}
          {customRules.map((rule) => renderRule(rule, this.removeRule))}
        </Popover>
      );
      classes.push(
        anyUnfulfilled
          ? "btn-dependency-unfulfilledrule"
          : "btn-dependency-hasrules",
      );
    } else {
      classes.push("btn-dependency-norules");
      popover = <Popover id={`popover-${mod.id}`}>{t("No rules")}</Popover>;
    }

    return connectDragSource(
      <div style={{ display: "inline" }}>
        <tooltip.IconButton
          id={`btn-meta-data-${mod.id}`}
          className={classes.join(" ")}
          key={`rules-${mod.id}`}
          tooltip={t("Drag to another mod to define dependency")}
          icon="connection"
          ref={this.setRef}
          onClick={this.toggleOverlay}
        />
        <Overlay
          show={this.state.showOverlay}
          onHide={this.hideOverlay}
          placement="left"
          rootClose={true}
          target={this.mRef as any}
        >
          {popover}
        </Overlay>
      </div>,
    );
  }

  private findRule(ref: IModLookupInfo): IBiDirRule {
    const { mod } = this.props;
    return this.state.modRules.find(
      (rule) =>
        (util.testModReference(mod, rule.source) &&
          util.testModReference(ref, rule.reference)) ||
        (util.testModReference(ref, rule.source) &&
          util.testModReference(mod, rule.reference)),
    );
  }

  private renderOverrideIcon(mod: types.IMod) {
    const { t } = this.props;
    if (
      (mod as any).fileOverrides === undefined ||
      (mod as any).fileOverrides.length === 0
    ) {
      return null;
    }

    return (
      <tooltip.IconButton
        id={`btn-meta-overrides-${mod.id}`}
        className="btn-overrides"
        key={`overrides-${mod.id}`}
        tooltip={t("This mod has files override the deploy order")}
        icon="override"
        onClick={this.openOverrideDialog}
      />
    );
  }

  private renderConflictIcon(mod: types.IMod) {
    const { t, conflicts, highlightConflict } = this.props;
    if (conflicts === undefined || conflicts[mod.id] === undefined) {
      return null;
    }

    const classes = ["btn-conflict"];

    const unsolvedConflict = conflicts[mod.id].find((conflict) => {
      const rule = this.findRule(conflict.otherMod);
      return rule === undefined;
    });

    if (unsolvedConflict !== undefined) {
      classes.push("btn-conflict-unsolved");
    } else {
      classes.push("btn-conflict-allsolved");
    }

    if (highlightConflict) {
      classes.push("btn-conflict-highlight");
    }

    const tip = t("Conflicts with: {{conflicts}}", {
      replace: {
        conflicts: conflicts[mod.id]
          .map((conflict) => this.renderModLookup(conflict.otherMod))
          .join("\n"),
      },
    });

    return (
      <tooltip.IconButton
        id={`btn-meta-conflicts-${mod.id}`}
        className={classes.join(" ")}
        key={`conflicts-${mod.id}`}
        tooltip={tip}
        icon="conflict"
        onClick={this.openConflictDialog}
      />
    );
  }

  private renderModLookup(lookupInfo: IModLookupInfo) {
    const id =
      lookupInfo.customFileName ||
      lookupInfo.logicalFileName ||
      lookupInfo.name;

    const version = lookupInfo.version;

    return version !== undefined ? id + " v" + version : id;
  }

  private setRef = (ref) => {
    this.mRef = ref;
  };

  private toggleOverlay = () => {
    this.nextState.showOverlay = !this.state.showOverlay;
  };

  private hideOverlay = () => {
    this.nextState.showOverlay = false;
  };

  private openConflictDialog = () => {
    const { gameId, mod, onConflictDialog } = this.props;
    const { modRules } = this.state;
    onConflictDialog(gameId, [mod.id], modRules);
  };

  private openOverrideDialog = () => {
    const { gameId, mod, onOverrideDialog } = this.props;
    onOverrideDialog(gameId, mod.id);
  };

  private key = (rule: types.IModRule) => {
    return [
      rule.type,
      rule.reference.logicalFileName ||
        rule.reference.fileExpression ||
        rule.reference.fileMD5 ||
        rule.reference.id,
      rule.reference.versionMatch ?? "*",
    ].join("_");
  };

  private removeRule = (rule: IRule) => {
    const { gameId, mod, onRemoveRule } = this.props;
    onRemoveRule(gameId, mod.id, rule);
  };

  private updateMod(mod: types.IMod) {
    const attributes = mod.attributes || {};
    this.nextState.reference = {
      fileMD5: attributes["fileMD5"],
      versionMatch: attributes["version"],
      fileExpression: mod.installationPath,
      logicalFileName: attributes["logicalFileName"],
    };
    if (attributes["fileMD5"] !== undefined) {
      this.context.api
        .lookupModMeta({
          fileMD5: attributes["fileMD5"],
          fileSize: attributes["fileSize"],
          gameId: attributes["downloadGame"] ?? this.props.gameId,
        })
        .then((meta: ILookupResult[]) => {
          if (this.mIsMounted && meta.length > 0) {
            this.nextState.modInfo = meta[0].value;
          }
        })
        .catch((err: Error) => {
          log("warn", "failed to look up mod", {
            err: err.message,
            stack: err.stack,
          });
        });
    }
  }
}

const type = "dependency-management-icon";

const DependencyIconDrag = DropTarget(
  type,
  dependencyTarget,
  collectDrop,
)(DragSource(type, dependencySource, collectDrag)(DependencyIcon));

const emptyObj = {};

function mapStateToProps(state: types.IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  const gameId = profile !== undefined ? profile.gameId : undefined;

  return {
    gameId,
    conflicts: util.getSafe(
      state.session,
      ["dependencies", "conflicts"],
      emptyObj,
    ),
    mods: state.persistent.mods[gameId],
    enabledMods: enabledModKeys(state),
    modState: profile !== undefined ? profile.modState : undefined,
    source: util.getSafe(
      state,
      ["session", "dependencies", "connection", "source"],
      undefined,
    ),
    highlightConflict: util.getSafe(
      state,
      ["session", "dependencies", "highlightConflicts"],
      false,
    ),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, modId, reference, defaultType) =>
      dispatch(setCreateRule(gameId, modId, reference, defaultType)),
    onRemoveRule: (gameId, modId, rule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onConflictDialog: (gameId, modIds, modRules) =>
      dispatch(setConflictDialog(gameId, modIds, modRules)),
    onOverrideDialog: (gameId: string, modId: string) =>
      dispatch(setFileOverrideDialog(gameId, modId)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DependencyIconDrag) as React.ComponentType<IBaseProps>;
