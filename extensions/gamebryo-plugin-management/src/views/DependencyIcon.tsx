import { addRule, removeRule } from "../actions/userlist";
import {
  setCreateRule,
  setQuickEdit,
  setSource,
  setTarget,
} from "../actions/userlistEdit";

import { ILOOTList, ILOOTPlugin, ILootReference } from "../types/ILOOTList";
import { IPluginCombined } from "../types/IPlugins";

import { NAMESPACE } from "../statics";

import I18next from "i18next";
import * as PropTypes from "prop-types";
import * as React from "react";
import { Button, Overlay, Popover } from "react-bootstrap";
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
import ReactMarkdown from "react-markdown";
import { findDOMNode } from "react-dom";
import { connect } from "react-redux";
import {
  Advanced,
  ComponentEx,
  log,
  selectors,
  tooltip,
  util,
} from "vortex-api";

type TranslationFunction = typeof I18next.t;

function splitOnce(input: string, separator: string): string[] {
  const idx = input.indexOf(separator);
  return [input.slice(0, idx), input.slice(idx + 1)];
}

export interface IBaseProps {
  plugin: IPluginCombined;
  t: TranslationFunction;
  onHighlight: (highlight: boolean) => void;
}

interface IConnectedProps {
  gameId: string;
  userlist: ILOOTPlugin[];
  masterlist: ILOOTPlugin[];
  quickEdit: { plugin: string; mode: string };
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number; y: number }) => void;
  onSetTarget: (id: string, pos: { x: number; y: number }) => void;
  onEditDialog: (
    referenceId: string,
    reference: string,
    defaultType: string,
  ) => void;
  onAddRule: (referenceId: string, reference: string, type: string) => void;
  onRemoveRule: (referenceId: string, reference: string, type: string) => void;
  onQuickEdit: (pluginId: string, mode: string) => void;
}

interface IComponentState {
  reference: string;
  showOverlay: boolean;
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
  try {
    const box = (findDOMNode(component) as Element).getBoundingClientRect();
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
    };
  } catch (err) {
    log("error", "failed to find component", { error: err.message });
  }
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
    if (dist > 2) {
      /*
      const sourceId = (monitor.getItem() as any).id;
      onSetSource(sourceId, componentCenter(component));
      */
      lastUpdatePos = curPos;
      onSetTarget(null, curPos);
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
      id: props.plugin.id,
    };
  },

  endDrag(
    props: IProps,
    monitor: DragSourceMonitor,
    component: React.Component<IProps, {}>,
  ) {
    clearTimeout(cursorPosUpdater);
    cursorPosUpdater = undefined;

    const sourcePlugin: any = monitor.getItem();
    const source: string = sourcePlugin.id;
    props.onSetSource(source, undefined);

    if (monitor.getDropResult() === null) {
      return;
    }

    const destPlugin: any = monitor.getDropResult();
    const dest: string = destPlugin.id;

    if (source !== dest) {
      if (
        component !== null &&
        (component.context as any).getModifiers().ctrl
      ) {
        const plugin = props.userlist.find(
          (iter) => iter.name === sourcePlugin.id,
        );
        if (plugin !== undefined) {
          if ((plugin.after || []).indexOf(destPlugin.id) !== -1) {
            // don't add a duplicate rule
            return;
          }
        }

        props.onAddRule(sourcePlugin.id, destPlugin.id, "after");
      } else {
        props.onEditDialog(sourcePlugin.id, destPlugin.id, "after");
      }
    }
  },
};

const dependencyTarget: DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: DropTargetMonitor, component) {
    return {
      id: props.plugin.id,
    };
  },
};

function collectDrag(
  dragConnect: DragSourceConnector,
  monitor: DragSourceMonitor,
): IDragProps {
  return {
    connectDragSource: dragConnect.dragSource(),
    connectDragPreview: dragConnect.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(
  dropConnect: DropTargetConnector,
  monitor: DropTargetMonitor,
): IDropProps {
  return {
    connectDropTarget: dropConnect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

// a regular expression to check if a string is a regular expression. How cool is that?
// also: not really, but it's what LOOT uses
const RE_MATCH = /[:\*?|]/;

class DependencyIcon extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    getModifiers: PropTypes.func,
  };

  private mRef: JSX.Element;

  constructor(props: IProps) {
    super(props);

    this.initState({ reference: undefined, showOverlay: false });
  }

  public componentDidMount() {
    this.props.connectDragPreview(getEmptyImage() as any);
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.isDragging !== nextProps.isDragging) {
      let pos;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.plugin.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      let pos;
      if (nextProps.isOver) {
        pos = componentCenter(this);
      }
      nextProps.onHighlight(nextProps.isOver);
      nextProps.onSetTarget(nextProps.plugin.id, pos);
    }
  }

  public render(): JSX.Element {
    const { plugin, quickEdit } = this.props;

    if (quickEdit.plugin !== undefined) {
      return plugin.id === quickEdit.plugin
        ? this.renderQuickEditClose()
        : this.renderQuickEditCheckbox();
    } else {
      return this.renderConnector();
    }
  }

  private renderQuickEditClose(): JSX.Element {
    const { t } = this.props;
    return (
      <div style={{ textAlign: "center", width: "100%" }}>
        <tooltip.IconButton
          id="close-userlist-quickedit"
          key="close-userlist-quickedit"
          className="quickedit-close"
          tooltip={t("Close")}
          onClick={this.closeQuickEdit}
          icon="input-confirm"
        />
      </div>
    );
  }

  private renderQuickEditCheckbox(): JSX.Element {
    const { t, masterlist, plugin, quickEdit, userlist } = this.props;
    const refPlugin = userlist.find((iter) => iter.name === quickEdit.plugin);
    const refMasterPlugin = masterlist.find(
      (iter) => iter.name === quickEdit.plugin,
    );
    const masterEnabled =
      util.getSafe(refMasterPlugin, [quickEdit.mode], []).indexOf(plugin.id) !==
      -1;
    const thisEnabled =
      masterEnabled ||
      util.getSafe(refPlugin, [quickEdit.mode], []).indexOf(plugin.id) !== -1;

    const tooltipText = t("load {{ reference }} after {{ name }}", {
      replace: {
        name: plugin.name,
        reference: quickEdit.plugin,
      },
      ns: NAMESPACE,
    });
    return (
      <div style={{ textAlign: "center", width: "100%" }}>
        <tooltip.ToggleButton
          id={`quick-edit-${quickEdit.plugin}`}
          onIcon="checkbox-checked"
          offIcon="checkbox-unchecked"
          state={thisEnabled}
          disabled={masterEnabled}
          onClick={this.toggleQuick}
          tooltip={tooltipText}
          offTooltip={tooltipText}
        />
      </div>
    );
  }

  private nameMatch(pattern: string, name: string): boolean {
    if (pattern.search(RE_MATCH) !== -1) {
      return new RegExp(pattern, "i").test(name);
    } else {
      return pattern.toUpperCase() === name.toUpperCase();
    }
  }

  private renderConnector(): JSX.Element {
    const {
      t,
      connectDragSource,
      connectDropTarget,
      masterlist,
      plugin,
      userlist,
    } = this.props;

    // TODO: this is quite inefficient...
    const lootRules: { name: string; ro: ILOOTPlugin; rw: ILOOTPlugin } = {
      name: plugin.name,
      ro: (masterlist || []).find((rule) =>
        this.nameMatch(rule.name, plugin.name),
      ) || { name: plugin.name },
      rw: (userlist || []).find((rule) =>
        this.nameMatch(rule.name, plugin.name),
      ) || { name: plugin.name },
    };

    const popoverBlocks = [];

    if (
      (lootRules.ro.after && lootRules.ro.after.length > 0) ||
      (lootRules.rw.after && lootRules.rw.after.length > 0)
    ) {
      popoverBlocks.push(
        <div key="after">
          {t("Loads after:", { ns: NAMESPACE })}
          <ul>
            {Array.from(
              util
                .getSafe(lootRules, ["ro", "after"], [])
                .map((ref) => this.renderRule(ref, "after", true)),
            )}
            {Array.from(
              util
                .getSafe(lootRules, ["rw", "after"], [])
                .map((ref) => this.renderRule(ref, "after", false)),
            )}
          </ul>
        </div>,
      );
    }

    if (
      (lootRules.ro.req && lootRules.ro.req.length > 0) ||
      (lootRules.rw.req && lootRules.rw.req.length > 0)
    ) {
      popoverBlocks.push(
        <div key="requires">
          {t("Requires:", { ns: NAMESPACE })}
          <ul>
            {Array.from(
              util
                .getSafe(lootRules, ["ro", "req"], [])
                .map((ref) => this.renderRule(ref, "requires", true)),
            )}
            {Array.from(
              util
                .getSafe(lootRules, ["rw", "req"], [])
                .map((ref) => this.renderRule(ref, "requires", false)),
            )}
          </ul>
        </div>,
      );
    }

    if (
      (lootRules.ro.inc && lootRules.ro.inc.length > 0) ||
      (lootRules.rw.inc && lootRules.rw.inc.length > 0)
    ) {
      popoverBlocks.push(
        <div key="incompatible">
          {t("Incompatible:", { ns: NAMESPACE })}
          <ul>
            {Array.from(
              util
                .getSafe(lootRules, ["ro", "inc"], [])
                .map((ref) => this.renderRule(ref, "incompatible", true)),
            )}
            {Array.from(
              util
                .getSafe(lootRules, ["rw", "inc"], [])
                .map((ref) => this.renderRule(ref, "incompatible", false)),
            )}
          </ul>
        </div>,
      );
    }

    const classes = ["btn-dependency"];

    if (popoverBlocks.length > 0) {
      classes.push("btn-dependency-hasrules");
    } else {
      popoverBlocks.push(
        t("Drag to another connector to define load order rules."),
      );
    }

    const popover = (
      <Popover id={`popover-${plugin.id}`} style={{ maxWidth: 500 }}>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>{popoverBlocks}</div>
        <div key="edit">
          <Advanced>
            <Button onClick={this.startQuickEdit}>{t("Edit")}</Button>
          </Advanced>
        </div>
      </Popover>
    );

    const connectorIcon = connectDragSource(
      <div style={{ display: "inline" }}>
        <tooltip.IconButton
          id={`btn-meta-data-${plugin.id}`}
          className={classes.join(" ")}
          key={`rules-${plugin.id}`}
          tooltip={t("Drag to another plugin to set userlist rule", {
            ns: NAMESPACE,
          })}
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

    return connectDropTarget(
      <div style={{ textAlign: "center", width: "100%" }}>{connectorIcon}</div>,
    );
  }

  private renderRule = (
    ref: string | ILootReference,
    ruleType: string,
    readOnly: boolean,
  ) => {
    const { t } = this.props;

    const { name, display } =
      typeof ref === "string" ? { name: ref, display: ref } : ref;

    if (readOnly) {
      return (
        <li key={String(name)} className="rule-readonly">
          {(ReactMarkdown as any)({ children: display || name })}
        </li>
      );
    }

    return (
      <li key={name}>
        {display}
        <tooltip.IconButton
          id={`btn-rule-remove-${name}`}
          value={`${ruleType}:${name}`}
          className="btn-embed"
          icon="remove"
          tooltip={t("Remove")}
          onClick={this.onRemove}
        />
      </li>
    );
  };

  private startQuickEdit = () => {
    const { plugin } = this.props;
    this.hideOverlay();
    this.props.onQuickEdit(plugin.id, "after");
  };

  private closeQuickEdit = () => {
    this.props.onQuickEdit(undefined, undefined);
  };

  private toggleQuick = () => {
    const { onAddRule, onRemoveRule, plugin, quickEdit, userlist } = this.props;
    const refPlugin = userlist.find((iter) => iter.name === quickEdit.plugin);
    const thisEnabled =
      util.getSafe(refPlugin, [quickEdit.mode], []).indexOf(plugin.id) !== -1;
    if (thisEnabled) {
      onRemoveRule(quickEdit.plugin, plugin.id, quickEdit.mode);
    } else {
      onAddRule(quickEdit.plugin, plugin.id, quickEdit.mode);
    }
  };

  private setRef = (ref) => {
    this.mRef = ref;
  };

  private toggleOverlay = () => {
    this.nextState.showOverlay = !this.state.showOverlay;
  };

  private hideOverlay = () => {
    this.nextState.showOverlay = false;
  };

  private onRemove = (evt) => {
    const { plugin, onRemoveRule } = this.props;
    const [ruleType, pluginId] = splitOnce(evt.currentTarget.value, ":");
    onRemoveRule(plugin.id, pluginId, ruleType);
  };
}

const type = "dependency-management-icon";

const DependencyIconDrag = DropTarget(
  type,
  dependencyTarget,
  collectDrop,
)(DragSource(type, dependencySource, collectDrag)(DependencyIcon));

const emptyList: ILOOTList = {
  globals: [],
  groups: [],
  plugins: [],
};

function mapStateToProps(state): IConnectedProps {
  return {
    gameId: selectors.activeGameId(state),
    userlist: (state.userlist || emptyList).plugins,
    masterlist: (state.masterlist || emptyList).plugins,
    quickEdit: state.session.pluginDependencies.quickEdit,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (pluginId, reference, defaultType) =>
      dispatch(setCreateRule(pluginId, reference, defaultType)),
    onAddRule: (pluginId, reference, ruleType) =>
      dispatch(addRule(pluginId, reference, ruleType)),
    onRemoveRule: (pluginId, reference, ruleType) =>
      dispatch(removeRule(pluginId, reference, ruleType)),
    onQuickEdit: (pluginId, mode) => dispatch(setQuickEdit(pluginId, mode)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(DependencyIconDrag) as any;
