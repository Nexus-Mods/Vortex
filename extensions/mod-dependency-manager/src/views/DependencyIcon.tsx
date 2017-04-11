import { IConflict } from '../types/IConflict';

import { setConflictDialog, setCreateRule, setSource, setTarget } from '../actions';

import { ComponentEx, actions, log, selectors, tooltip, types, util } from 'nmm-api';

import { ILookupResult, IModInfo, IReference, IRule, RuleType } from 'modmeta-db';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';
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
      case 'before': renderString = t('loads before'); break;
      case 'after': renderString = t('loads after'); break;
      case 'requires': renderString = t('requires'); break;
      case 'recommends': renderString = t('recommends'); break;
      case 'conflicts': renderString = t('conflicts with'); break;
      case 'provides': renderString = t('provides'); break;
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
  t: I18next.TranslationFunction;
  mod: types.IMod;
}

interface IConnectedProps {
  gameId: string;
  conflicts: { [modId: string]: IConflict[] };
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, modId: string, reference: IReference, defaultType: string) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IRule) => void;
  onConflictDialog: (gameId: string, modId: string) => void;
}

interface IComponentState {
  reference: IReference;
  modInfo: IModInfo;
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
      const sourceId = (monitor.getItem() as any).id;
      onSetSource(sourceId, componentCenter(component));
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
      id: props.mod.id,
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
    const reference: IReference = (monitor.getDropResult() as any).reference;

    if (source !== dest) {
      props.onEditDialog(props.gameId, source, reference, 'before');
    }
  },
};

const dependencyTarget: __ReactDnd.DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: __ReactDnd.DropTargetMonitor, component) {
    return {
      id: props.mod.id,
      reference: (component as any).decoratedComponentInstance.state.reference,
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
  private mRef: JSX.Element;

  constructor(props: IProps) {
    super(props);

    this.initState({ modInfo: undefined, reference: undefined, showOverlay: false });
    this.mIsMounted = false;
  }

  public componentWillMount() {
    this.updateMod(this.props.mod);
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.props.connectDragPreview(getEmptyImage());
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.mod !== nextProps.mod) {
      this.updateMod(nextProps.mod);
    }

    if (this.props.isDragging !== nextProps.isDragging) {
      let pos = undefined;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.mod.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      let pos = undefined;
      if (nextProps.isOver) {
        pos = componentCenter(this);
      }
      nextProps.onSetTarget(nextProps.mod.id, pos);
    }
  }

  public render(): JSX.Element {
    const { t, conflicts, connectDragSource, connectDropTarget, mod } = this.props;

    let classes = ['btn-dependency'];

    let staticRules = util.getSafe(this.state, ['modInfo', 'rules'], []);
    let customRules = util.getSafe(mod, ['rules'], []);

    if ((staticRules.length > 0) || (customRules.length > 0)) {
      classes.push('btn-dependency-hasrules');
    } else {
      classes.push('btn-dependency-norules');
    }

    // TODO are there unfulfilled rules?
    // TODO are there file conflicts with a mod and no rule?

    let popover = <Popover id={`popover-${mod.id}`} style={{ maxWidth: 500 }}>
      {staticRules.map((rule) =>
        <RuleDescription rule={rule} t={t} key={this.key(rule)} removeable={false} />)}
      {customRules.map((rule) =>
        <RuleDescription
          rule={rule}
          t={t}
          key={this.key(rule)}
          removeable={true}
          onRemoveRule={this.removeRule}
        />)}
    </Popover>;

    let connectorIcon = connectDropTarget(
      connectDragSource(
        <div style={{ display: 'inline' }}>
          <tooltip.IconButton
            id={`btn-meta-data-${mod.id}`}
            className={classes.join(' ')}
            key={`rules-${mod.id}`}
            tooltip={t('Drag to another mod to define dependency')}
            icon='plug'
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
        </div>
      )
    );

    let conflictIcon = null;
    if (conflicts[mod.id] !== undefined) {
      let tip = t('Conflicts with: {{conflicts}}', { replace: {
        conflicts: conflicts[mod.id].map(conflict => conflict.otherMod).join('\n'),
      } });
      conflictIcon = <tooltip.IconButton
        id={`btn-meta-conflicts-${mod.id}`}
        className='btn-conflict'
        key={`conflicts-${mod.id}`}
        tooltip={tip}
        icon='bolt'
        onClick={this.openConflictDialog}
      />;
    }

    return <div style={{ textAlign: 'center', width: '100%', position: 'relative' }}>
      {connectorIcon}
      {conflictIcon}
      </div>;
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

  private openConflictDialog = () => {
    const { gameId, mod, onConflictDialog } = this.props;
    onConflictDialog(gameId, mod.id);
  }

  private key = (rule: IRule) => {
    return rule.type + '_' +
      rule.reference.logicalFileName
      || rule.reference.fileExpression
      || rule.reference.fileMD5;
  }

  private removeRule = (rule: IRule) => {
    const { gameId, mod, onRemoveRule } = this.props;
    onRemoveRule(gameId, mod.id, rule);
  }

  private updateMod(mod: types.IMod) {
    // tslint:disable:no-string-literal
    this.nextState.reference = {
      fileMD5: mod.attributes['fileMD5'],
      versionMatch: mod.attributes['version'],
      fileExpression: mod.installationPath,
      logicalFileName: mod.attributes['logicalFileName'],
      modId: mod.attributes['modId'],
    };

    this.context.api.lookupModMeta({
      fileMD5: mod.attributes['fileMD5'],
      fileSize: mod.attributes['fileSize'],
      gameId: this.props.gameId,
      modId: mod.attributes['modId'],
    })
    // tslint:enable:no-string-literal
      .then((meta: ILookupResult[]) => {
        if (this.mIsMounted && (meta.length > 0)) {
          this.nextState.modInfo = meta[0].value;
        }
      })
      .catch((err: Error) => {
        log('warn', 'failed to look up mod', { err: err.message, stack: err.stack });
      });
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
    conflicts: state.session.dependencies.conflicts,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, modId, reference, defaultType) =>
      dispatch(setCreateRule(gameId, modId, reference, defaultType)),
    onRemoveRule: (gameId, modId, rule) => dispatch(actions.removeModRule(gameId, modId, rule)),
    onConflictDialog: (gameId, modId) => dispatch(setConflictDialog(gameId, modId)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    DependencyIconDrag
  ) as React.ComponentClass<IBaseProps>;
