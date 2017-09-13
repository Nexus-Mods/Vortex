import { removeRule } from '../actions/userlist';
import { setCreateRule, setSource, setTarget } from '../actions/userlistEdit';

import { ILOOTPlugin, ILootReference } from '../types/ILOOTList';
import { IPluginCombined } from '../types/IPlugins';

import { ComponentEx, selectors, tooltip } from 'vortex-api';

import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';

function splitOnce(input: string, separator: string): string[] {
  const idx = input.indexOf(separator);
  return [input.slice(0, idx), input.slice(idx + 1)];
}

export interface IBaseProps {
  plugin: IPluginCombined;
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  gameId: string;
  userlist: ILOOTPlugin[];
  masterlist: ILOOTPlugin[];
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, referenceId: string,
                 reference: string, defaultType: string) => void;
  onRemoveRule: (gameId: string, referenceId: string, reference: string, type: string) => void;
}

interface IComponentState {
  reference: string;
  showOverlay: boolean;
}

interface IDragProps {
  connectDragSource: __ReactDnd.ConnectDragSource;
  connectDragPreview: __ReactDnd.ConnectDragPreview;
  isDragging: boolean;
}

interface IDropProps {
  connectDropTarget: __ReactDnd.ConnectDropTarget;
  isOver: boolean;
  canDrop: boolean;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & IDragProps & IDropProps;

interface IDragInfo {
  onUpdateLine: (targetX: number, targetY: number, isConnect: boolean) => void;
}

function componentCenter(component: React.Component<any, any>) {
  const box = findDOMNode(component).getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

// what a hack... :(
// react-dnd seems to completely block the mousemove event so the monitor seems to be
// the only way to get at the cursor position. It doesn't fire events on movement though
let cursorPosUpdater: NodeJS.Timer;
let lastUpdatePos: { x: number, y: number } = { x: 0, y: 0 };
function updateCursorPos(monitor: __ReactDnd.DragSourceMonitor,
                         component: React.Component<any, any>,
                         onSetSource: (id: string, pos: { x: number, y: number }) => void,
                         onSetTarget: (id: string, pos: { x: number, y: number }) => void) {
  if (monitor.getClientOffset() !== null) {
    const curPos = monitor.getClientOffset();
    const dist = Math.abs(curPos.x - lastUpdatePos.x) + Math.abs(curPos.y - lastUpdatePos.y);
    if (dist > 2) {
      /*
      const sourceId = (monitor.getItem() as any).id;
      onSetSource(sourceId, componentCenter(component));
      */
      lastUpdatePos = curPos;
      onSetTarget(null, curPos);
    }
  }
  cursorPosUpdater = setTimeout(() =>
    updateCursorPos(monitor, component, onSetSource, onSetTarget), 50);
}

const dependencySource: __ReactDnd.DragSourceSpec<IProps> = {
  beginDrag(props: IProps, monitor: __ReactDnd.DragSourceMonitor, component) {
    updateCursorPos(monitor, component, props.onSetSource, props.onSetTarget);
    return {
      id: props.plugin.name,
    };
  },
  endDrag(props: IProps, monitor: __ReactDnd.DragSourceMonitor) {
    clearTimeout(cursorPosUpdater);
    cursorPosUpdater = undefined;

    const source: string = (monitor.getItem() as any).id;
    props.onSetSource(source, undefined);

    if (monitor.getDropResult() === null) {
      return;
    }

    const dest: string = (monitor.getDropResult() as any).id;

    if (source !== dest) {
      props.onEditDialog(props.gameId, source, dest, 'after');
    }
  },
};

const dependencyTarget: __ReactDnd.DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: __ReactDnd.DropTargetMonitor, component) {
    return {
      id: props.plugin.name,
    };
  },
};

function collectDrag(dragConnect: __ReactDnd.DragSourceConnector,
                     monitor: __ReactDnd.DragSourceMonitor): IDragProps {
  return {
    connectDragSource: dragConnect.dragSource(),
    connectDragPreview: dragConnect.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(dropConnect: __ReactDnd.DropTargetConnector,
                     monitor: __ReactDnd.DropTargetMonitor): IDropProps {
  return {
    connectDropTarget: dropConnect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

class DependencyIcon extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean;
  private mRef: JSX.Element;

  constructor(props: IProps) {
    super(props);

    this.initState({ reference: undefined, showOverlay: false });
    this.mIsMounted = false;
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.props.connectDragPreview(getEmptyImage());
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.isDragging !== nextProps.isDragging) {
      let pos;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.plugin.name, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      let pos;
      if (nextProps.isOver) {
        pos = componentCenter(this);
      }
      nextProps.onSetTarget(nextProps.plugin.name, pos);
    }
  }

  public render(): JSX.Element {
    const { t, connectDragSource, connectDropTarget, masterlist, plugin, userlist } = this.props;

    const classes = ['btn-dependency'];

    // TODO: this is quite inefficient...
    const lootRules: ILOOTPlugin = {
      name: plugin.name,
      ...this.pluginFrom((masterlist || []).find(rule => rule.name === plugin.name), true),
      ...this.pluginFrom((userlist || []).find(rule => rule.name === plugin.name), false),
    };

    const popoverBlocks = [];

    if ((lootRules.after !== undefined) && (lootRules.after.length > 0)) {
      popoverBlocks.push((
        <div key='after'>
          {t('Loads after:')}
          <ul>
            {(lootRules.after || []).map(
              ref => this.renderRule(ref, 'after', lootRules.readOnly))}
          </ul>
        </div>
      ));
    }

    if ((lootRules.req !== undefined) && (lootRules.req.length > 0)) {
      popoverBlocks.push((
        <div key='requires'>
        {t('Requires:')}
        <ul>
          {(lootRules.req || []).map(
            ref => this.renderRule(ref, 'requires', lootRules.readOnly))}
        </ul>
      </div>
      ));
    }

    if ((lootRules.inc !== undefined) && (lootRules.inc.length > 0)) {
      popoverBlocks.push((
        <div key='incompatible'>
        {t('Incompatible:')}
        <ul>
          {(lootRules.inc || []).map(
            ref => this.renderRule(ref, 'incompatible', lootRules.readOnly))}
        </ul>
      </div>
      ));
    }

    if (popoverBlocks.length > 0) {
      classes.push('btn-dependency-hasrules');
    } else {
      popoverBlocks.push(t('Drag to another connector to define load order rules.'));
    }
    const popover = (
      <Popover id={`popover-${plugin.name}`} style={{ maxWidth: 500 }}>
      {popoverBlocks}
    </Popover>
    );

    const connectorIcon = connectDragSource(
        <div style={{ display: 'inline' }}>
          <tooltip.IconButton
            id={`btn-meta-data-${plugin.name}`}
            className={classes.join(' ')}
            key={`rules-${plugin.name}`}
            tooltip={t('Drag to another plugin to set userlist rule')}
            icon='connect'
            ref={this.setRef}
            onClick={this.toggleOverlay}
          />
          <Overlay
            show={this.state.showOverlay}
            onHide={this.hideOverlay}
            placement='left'
            rootClose={true}
            target={this.mRef as any}
          >
            {popover}
          </Overlay>
        </div>);

    return connectDropTarget(
      <div style={{ textAlign: 'center', width: '100%' }}>
        {connectorIcon}
      </div>);
  }

  private renderRule = (ref: string | ILootReference, ruleType: string, readOnly: boolean) => {
    const { t } = this.props;

    const { name, display } = (typeof(ref) === 'string')
      ? { name: ref, display: ref }
      : ref;

    if (readOnly) {
      return <li key={name} className='rule-readonly'>{display}</li>;
    }

    return (
      <li key={name}>{display}
        <tooltip.IconButton
          id={`btn-rule-remove-${name}`}
          value={`${ruleType}:${name}`}
          className='btn-embed'
          icon='remove'
          tooltip={t('Remove')}
          onClick={this.onRemove}
        />
      </li>
    );
  }
  private setRef = (ref) => {
    this.mRef = ref;
  }

  private toggleOverlay = () => {
    this.nextState.showOverlay = !this.state.showOverlay;
  }

  private hideOverlay = () => {
    this.nextState.showOverlay = false;
  }

  private pluginFrom(input: ILOOTPlugin, readOnly: boolean): ILOOTPlugin {
    if (input === undefined) {
      return undefined;
    }
    return readOnly === true
      ? { ...input, readOnly: true }
      : input;
  }

  /*
  private removeRule = (plugin: string, type: string, reference: string) => {
    const { gameId, plugin, onRemoveRule } = this.props;
    onRemoveRule(gameId, plugin.name, rule);
  }*/

  private onRemove = (evt) => {
    const { gameId, plugin, onRemoveRule } = this.props;
    const [ ruleType, pluginId ] = splitOnce(evt.currentTarget.value, ':');
    onRemoveRule(gameId, plugin.name, pluginId, ruleType);
  }
}

const type = 'dependency-management-icon';

const DependencyIconDrag =
  DropTarget(type, dependencyTarget, collectDrop)(
    DragSource(type, dependencySource, collectDrag)(
      DependencyIcon));

function mapStateToProps(state): IConnectedProps {
  return {
    gameId: selectors.activeGameId(state),
    userlist: state.userlist.plugins,
    masterlist: state.masterlist.plugins,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, pluginId, reference, defaultType) =>
      dispatch(setCreateRule(gameId, pluginId, reference, defaultType)),
    onRemoveRule: (gameId, pluginId, reference, ruleType) =>
      dispatch(removeRule(gameId, pluginId, reference, ruleType)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
      DependencyIconDrag) as React.ComponentClass<IBaseProps>;
