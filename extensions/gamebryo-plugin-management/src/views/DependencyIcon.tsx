import { removeRule } from '../actions/userlist';
import { setCreateRule, setSource, setTarget } from '../actions/userlistEdit';

import { ILOOTPlugin } from '../types/ILOOTList';
import { IPluginCombined } from '../types/IPlugins';

import { ComponentEx, selectors, tooltip } from 'nmm-api';

import { IReference, IRule, RuleType } from 'modmeta-db';
import * as React from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';

interface IDescriptionProps {
  t: I18next.TranslationFunction;
  rule: IRule;
  removeable: boolean;
  key: string;
  onRemoveRule?: (rule: IRule) => void;
}

function splitOnce(input: string, separator: string): string[] {
  const idx = input.indexOf(separator);
  return [input.slice(0, idx), input.slice(idx + 1)];
}

class RuleDescription extends React.Component<IDescriptionProps, {}> {

  public render(): JSX.Element {
    const {rule, removeable} = this.props;

    const key = this.key(rule);
    return <div key={ key }>
      {this.renderType(rule.type)}
      {' '}
      {this.renderReference(rule.reference)}
      {removeable ? this.renderRemove() : null}
    </div>;
  }

  private key(rule: IRule) {
    return rule.type + '_' + rule.reference.logicalFileName
      || rule.reference.fileExpression
      || rule.reference.fileMD5;
  }

  private renderRemove = () => {
    const {t, rule} = this.props;
    return (<tooltip.IconButton
      id={this.key(rule)}
      className='btn-embed'
      icon='remove'
      tooltip={t('Remove')}
      onClick={this.removeThis}
    />);
  }

  private removeThis = () => {
    this.props.onRemoveRule(this.props.rule);
  }

  private renderType = (type: RuleType): JSX.Element => {
    const {t} = this.props;
    let renderString: string;
    switch (type) {
      case 'after': renderString = t('loads after'); break;
      default: throw new Error('invalid rule type ' + type);
    }
    return <p style={{ display: 'inline' }}>{renderString}</p>;
  }

  private renderReference = (ref: IReference): JSX.Element => {
    const style = { display: 'inline' };
    if ((ref.logicalFileName === undefined) && (ref.fileExpression === undefined)) {
      return <p style={style}>{ ref.fileMD5 }</p>;
    }
    return <p style={style}>
      {ref.logicalFileName || ref.fileExpression} {ref.versionMatch} (mod: {ref.modId || '?'})
    </p>;
  }
}

export interface IBaseProps {
  plugin: IPluginCombined;
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  gameId: string;
  userlist: ILOOTPlugin[];
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
  let box = findDOMNode(component).getBoundingClientRect();
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

function collectDrag(connect: __ReactDnd.DragSourceConnector,
                     monitor: __ReactDnd.DragSourceMonitor): IDragProps {
  return {
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connect: __ReactDnd.DropTargetConnector,
                     monitor: __ReactDnd.DropTargetMonitor): IDropProps {
  return {
    connectDropTarget: connect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

class DependencyIcon extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean;

  constructor(props: IProps) {
    super(props);

    this.initState({ reference: undefined });
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
      let pos = undefined;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.plugin.name, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      let pos = undefined;
      if (nextProps.isOver) {
        pos = componentCenter(this);
      }
      nextProps.onSetTarget(nextProps.plugin.name, pos);
    }
  }

  public render(): JSX.Element {
    const { t, connectDragSource, connectDropTarget, plugin, userlist } = this.props;

    let classes = ['btn-dependency'];

    let lootRules: ILOOTPlugin = userlist.find(rule => rule.name === plugin.name) || {
      name: plugin.name,
    };

    let popoverBlocks = [];

    if ((lootRules.after !== undefined) && (lootRules.after.length > 0)) {
      popoverBlocks.push(<div key='after'>
        {t('Loads after:')}
        <ul>
          {(lootRules.after || []).map(name => this.renderRule(name, 'after'))}
        </ul>
      </div>);
    }

    if ((lootRules.req !== undefined) && (lootRules.req.length > 0)) {
      popoverBlocks.push(<div key='requires'>
        {t('Requires:')}
        <ul>
          {(lootRules.req || []).map(name => this.renderRule(name, 'requires'))}
        </ul>
      </div>);
    }

    if ((lootRules.inc !== undefined) && (lootRules.inc.length > 0)) {
      popoverBlocks.push(<div key='incompatible'>
        {t('Incompatible:')}
        <ul>
          {(lootRules.inc || []).map(name => this.renderRule(name, 'incompatible'))}
        </ul>
      </div>);
    }

    if (popoverBlocks.length > 0) {
      classes.push('btn-dependency-hasrules');
    } else {
      popoverBlocks.push(t('Drag to another connector to define load order rules.'));
    }
    const popover = <Popover id={`popover-${plugin.name}`} style={{ maxWidth: 500 }}>
      {popoverBlocks}
    </Popover>;

    let connectorIcon = connectDropTarget(
      connectDragSource(
        <div style={{ display: 'inline' }}>
          <OverlayTrigger trigger='click' rootClose placement='bottom' overlay={popover}>
          <tooltip.IconButton
            id={`btn-meta-data-${plugin.name}`}
            className={classes.join(' ')}
            key={`rules-${plugin.name}`}
            tooltip={t('Drag to another plugin to set userlist rule')}
            icon='plug'
          />
          </OverlayTrigger>
          </div>
      )
    );

    return <div style={{ textAlign: 'center', width: '100%' }}>
      {connectorIcon}
      </div>;
  }

  private renderRule = (name: string, type: string) => {
    const { t } = this.props;
    return <li key={name}>{name}
      <tooltip.IconButton
        id={`btn-rule-remove-${name}`}
        value={`${type}:${name}`}
        className='btn-embed'
        icon='remove'
        tooltip={t('Remove')}
        onClick={this.onRemove}
      />
    </li>;
  }
  /*
  private removeRule = (plugin: string, type: string, reference: string) => {
    const { gameId, plugin, onRemoveRule } = this.props;
    onRemoveRule(gameId, plugin.name, rule);
  }*/

  private onRemove = (evt) => {
    const { gameId, plugin, onRemoveRule } = this.props;
    let [ type, pluginId ] = splitOnce(evt.currentTarget.value, ':');
    onRemoveRule(gameId, plugin.name, pluginId, type);
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
    connect(mapStateToProps, mapDispatchToProps)(DependencyIconDrag
  ) as React.ComponentClass<IBaseProps>;
