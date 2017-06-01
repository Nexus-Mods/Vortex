import { IBiDirRule } from '../types/IBiDirRule';
import { IConflict } from '../types/IConflict';
import { IModLookupInfo } from '../types/IModLookupInfo';

import matchReference from '../util/matchReference';
import renderModName from '../util/renderModName';

import { setConflictDialog, setCreateRule, setSource, setTarget } from '../actions';

import { enabledModKeys } from '../selectors';

import * as _ from 'lodash';
import { ILookupResult, IModInfo, IReference, IRule, RuleType } from 'modmeta-db';
import { actions, ComponentEx, log, selectors, tooltip, types, util } from 'nmm-api';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';

interface IDescriptionProps {
  t: I18next.TranslationFunction;
  rule: IRule;
  key: string;
  onRemoveRule?: (rule: IRule) => void;
  fulfilled: boolean;
}

class RuleDescription extends React.Component<IDescriptionProps, {}> {
  public render(): JSX.Element {
    const {onRemoveRule, rule} = this.props;

    const key = this.key(rule);
    return (
      <div
        key={key}
        className={this.className()}
      >
        {this.renderType(rule.type)}
        {' '}
        {this.renderReference(rule.reference)}
        {this.renderRemove()}
      </div>
    );
  }

  private className() {
    const {fulfilled} = this.props;
    if (fulfilled === null) {
      return undefined;
    } else if (fulfilled) {
      return 'rule-fulfilled';
    } else {
      return 'rule-unfulfilled';
    }
  }

  private key(rule: IRule) {
    return rule.type + '_' + rule.reference.logicalFileName
      || rule.reference.fileExpression
      || rule.reference.fileMD5;
  }

  private renderRemove = () => {
    const {t, onRemoveRule, rule} = this.props;

    if (onRemoveRule === undefined) {
      return null;
    }

    return (
      <tooltip.IconButton
        id={this.key(rule)}
        className='btn-embed'
        icon='remove'
        tooltip={t('Remove')}
        onClick={this.removeThis}
      />
    );
  }

  private removeThis = () => {
    this.props.onRemoveRule(this.props.rule);
  }

  private renderType = (type: RuleType): JSX.Element => {
    const {t} = this.props;
    let renderString: string;
    switch (type) {
      case 'before': renderString = t('Loads before'); break;
      case 'after': renderString = t('Loads after'); break;
      case 'requires': renderString = t('Requires'); break;
      case 'recommends': renderString = t('Recommends'); break;
      case 'conflicts': renderString = t('Conflicts with'); break;
      case 'provides': renderString = t('Provides'); break;
      default: throw new Error('invalid rule type ' + type);
    }
    return <p style={{ display: 'inline' }}>{renderString}</p>;
  }

  private renderReference = (ref: IReference): JSX.Element => {
    const style = { display: 'inline' };
    if ((ref.logicalFileName === undefined) && (ref.fileExpression === undefined)) {
      return <p style={style}>{ ref.fileMD5 }</p>;
    }
    return (
      <p style={style}>
        {ref.logicalFileName || ref.fileExpression} {ref.versionMatch}
    </p>
    );
  }
}

export interface IBaseProps {
  t: I18next.TranslationFunction;
  mod: types.IMod;
  rules: IBiDirRule[];
}

interface IConnectedProps {
  gameId: string;
  conflicts: { [modId: string]: IConflict[] };
  enabledMods: IModLookupInfo[];
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, modId: string, reference: IReference, defaultType: string) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IRule) => void;
  onConflictDialog: (gameId: string, modId: string, modRules: IBiDirRule[]) => void;
}

interface IComponentState {
  reference: IReference;
  modInfo: IModInfo;
  showOverlay: boolean;
  modRules: IBiDirRule[];
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

    this.initState({
      modInfo: undefined,
      reference: undefined,
      showOverlay: false,
      modRules: props.rules.filter(rule => matchReference(rule.source, props.mod)),
    });

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

  public componentWillReceiveProps(nextProps: IProps, nextState: IComponentState) {
    if (this.props.mod !== nextProps.mod) {
      this.updateMod(nextProps.mod);
    }

    if ((this.props.mod !== nextProps.mod) || (this.props.rules !== nextProps.rules)) {
      this.nextState.modRules = nextProps.rules.filter(rule =>
        matchReference(rule.source, nextProps.mod));
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
      nextProps.onSetTarget(nextProps.mod.id, pos);
    }
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IComponentState) {
    // enabledMods changes whenever any of the mods changes - even if that change
    // is not reflected in the reference stored in enabledMods
    return this.props.conflicts !== nextProps.conflicts
        || !_.isEqual(this.props.enabledMods, nextProps.enabledMods)
        || this.props.gameId !== nextProps.gameId
        || this.props.mod !== nextProps.mod
        || this.props.rules !== nextProps.rules
        || this.state !== nextState;
  }

  public render(): JSX.Element {
    const { connectDropTarget, mod } = this.props;

    if (mod.state !== 'installed') {
      return null;
    }

    return connectDropTarget(
      <div style={{ textAlign: 'center', width: '100%' }}>
        {this.renderConnectorIcon(mod)}
        {this.renderConflictIcon(mod)}
      </div>);
  }

  private renderConnectorIcon(mod: types.IMod) {
    const {t, connectDragSource, enabledMods} = this.props;

    const classes = ['btn-dependency'];

    let anyUnfulfilled = false;

    const isFulfilled = (rule: IRule) => {
      if (rule.type === 'conflicts') {
        if (this.findReference(rule.reference, enabledMods) !== undefined) {
          anyUnfulfilled = true;
          return false;
        } else {
          return true;
        }
      } else if (rule.type === 'requires') {
        if (this.findReference(rule.reference, enabledMods) === undefined) {
          anyUnfulfilled = true;
          return false;
        } else {
          return true;
        }
      } else {
        return null;
      }
    };

    let popover: JSX.Element;

    const staticRules = util.getSafe(this.state, ['modInfo', 'rules'], []);
    const customRules = util.getSafe(mod, ['rules'], []);

    if ((staticRules.length > 0) || (customRules.length > 0)) {
      popover = (
        <Popover id={`popover-${mod.id}`} style={{ maxWidth: 500 }}>
          {staticRules.map(rule => (
            <RuleDescription
              t={t}
              key={this.key(rule)}
              rule={rule}
              fulfilled={isFulfilled(rule)}
            />
          ))}
          {customRules.map(rule => (
            <RuleDescription
              t={t}
              key={this.key(rule)}
              rule={rule}
              onRemoveRule={this.removeRule}
              fulfilled={isFulfilled(rule)}
            />))}
        </Popover>
      );
      classes.push(anyUnfulfilled ? 'btn-dependency-unfulfilledrule' : 'btn-dependency-hasrules');
    } else {
      classes.push('btn-dependency-norules');
      popover = (
        <Popover id={`popover-${mod.id}`}>
          {t('No rules')}
        </Popover>
        );
    }

    return connectDragSource(
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
        </div>);
  }

  private findRule(ref: IModLookupInfo): IBiDirRule {
    return this.state.modRules.find(rule => {
      const res = matchReference(rule.reference, ref);
      return res;
    });
  }

  private renderConflictIcon(mod: types.IMod) {
    const { t, conflicts } = this.props;
    if (conflicts[mod.id] === undefined) {
      return null;
    }

    const classes = ['btn-conflict'];

    const unsolvedConflict = conflicts[mod.id].find(conflict => {
      const rule = this.findRule(conflict.otherMod);
      return rule === undefined;
    });

    if (unsolvedConflict !== undefined) {
      classes.push('btn-conflict-unsolved');
    } else {
      classes.push('btn-conflict-allsolved');
    }

    const tip = t('Conflicts with: {{conflicts}}', {
      replace: {
        conflicts: conflicts[mod.id].map(
          conflict => this.renderModLookup(conflict.otherMod)).join('\n'),
      },
    });

    return (
      <tooltip.IconButton
        id={`btn-meta-conflicts-${mod.id}`}
        className={classes.join(' ')}
        key={`conflicts-${mod.id}`}
        tooltip={tip}
        icon='bolt'
        onClick={this.openConflictDialog}
      />
    );
  }

  private renderModLookup(lookupInfo: IModLookupInfo) {
    const id = lookupInfo.customFileName
      || lookupInfo.logicalFileName
      || lookupInfo.name;

    const version = lookupInfo.version;

    return version !== undefined ? id + ' v' + version : id;
  }

  private findReference(reference: IReference, mods: IModLookupInfo[]): IModLookupInfo {
    return mods.find(mod => matchReference(reference, mod));
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
    const { modRules } = this.state;
    onConflictDialog(gameId, mod.id, modRules);
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
    this.nextState.reference = {
      fileMD5: mod.attributes['fileMD5'],
      versionMatch: mod.attributes['version'],
      fileExpression: mod.installationPath,
      logicalFileName: mod.attributes['logicalFileName'],
    };
    this.context.api.lookupModMeta({
      fileMD5: mod.attributes['fileMD5'],
      fileSize: mod.attributes['fileSize'],
      gameId: this.props.gameId,
    })
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
  const gameId = selectors.activeGameId(state);

  return {
    gameId,
    conflicts: state.session.dependencies.conflicts,
    enabledMods: enabledModKeys(state),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, modId, reference, defaultType) =>
      dispatch(setCreateRule(gameId, modId, reference, defaultType)),
    onRemoveRule: (gameId, modId, rule) => dispatch(actions.removeModRule(gameId, modId, rule)),
    onConflictDialog: (gameId, modId, modRules) =>
      dispatch(setConflictDialog(gameId, modId, modRules)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    DependencyIconDrag) as React.ComponentClass<IBaseProps>;
