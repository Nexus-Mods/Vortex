import * as actions from '../actions';

import { ComponentEx, log, selectors, tooltip, types, util } from 'nmm-api';

import { ILookupResult, IModInfo, IReference } from 'modmeta-db';
import * as path from 'path';
import * as React from 'react';
import {  } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

export interface IBaseProps {
  mod: types.IMod;
}

interface IConnectedProps {
  gameId: string;
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, modId: string, reference: IReference, defaultType: string) => void;
}

interface IComponentState {
  reference: IReference;
  modInfo: IModInfo;
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
/*
function emptyModInfo(gameId: string, mod: types.IMod): IModInfo {
  let modName = mod.attributes['name'] ||
    path.basename(mod.installationPath, path.extname(mod.installationPath));
  // tslint:disable:no-string-literal
  return {
    modId: mod.attributes['modId'],
    modName,
    fileName: mod.attributes['fileName'] || '',
    logicalFileName: mod.attributes['logicalFileName'] || '',
    fileSizeBytes: mod.attributes['fileSize'] || 0,
    gameId,
    fileVersion: mod.attributes['version'] || '',
    fileMD5: mod.attributes['fileMD5'] || '',
    sourceURI: '',
    rules: [],
    details: {},
  };
  // tslint:enable:no-string-literal
}
*/

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

  constructor(props: IProps) {
    super(props);

    this.initState({ modInfo: undefined, reference: undefined });
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

    if (nextProps.isDragging) {
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
    const { t, connectDragSource, connectDropTarget, mod } = this.props;

    let classes = ['btn-dependency'];

    if ((util.getSafe(this.state, ['modInfo', 'rules'], []).length > 0)
      || (util.getSafe(mod, ['rules'], []).length > 0)) {
      classes.push('btn-dependency-hasrules');
    } else {
      classes.push('btn-dependency-norules');
    }

    // TODO are there unfulfilled rules?
    // TODO are there file conflicts with a mod and no rule?

    return connectDropTarget(
      connectDragSource(
        <div style={{ textAlign: 'center', width: '100%' }}>
          <tooltip.IconButton
            id='btn-meta-data'
            className={classes.join(' ')}
            key={mod.id}
            tooltip={t('Drag to another mod to define dependency')}
            icon='plug'
          />
        </div>
      )
    );
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
          console.log('update mod info', meta[0]);
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
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(actions.setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(actions.setTarget(id, pos)),
    onEditDialog: (gameId, modId, reference, defaultType) =>
      dispatch(actions.setCreateRule(gameId, modId, reference, defaultType)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(DependencyIconDrag)
  ) as React.ComponentClass<IBaseProps>;
