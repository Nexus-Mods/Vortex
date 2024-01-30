import * as tooltip from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { ComponentEx } from '../../../util/ComponentEx';
import { setCreateTransfer, setSource, setTarget } from '../actions/transferSetup';
import * as selectors from '../selectors';
import { IProfile } from '../types/IProfile';

import { TFunction } from 'i18next';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget,
         DragSource, DragSourceConnector, DragSourceMonitor, DragSourceSpec,
         DropTarget, DropTargetConnector, DropTargetMonitor, DropTargetSpec } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';

export interface IBaseProps {
  profile: IProfile;
  t: TFunction;
  onSetHighlightGameId: (gameId: string) => void;
  disabled: boolean;
}

interface IConnectedProps {
  gameId: string;
  profiles: { [key: string]: IProfile };
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, source: string, target: string) => void;
}

interface IComponentState {
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
  sourceId: string;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & IDragProps & IDropProps;

interface IDragInfo {
  onUpdateLine: (targetX: number, targetY: number, isConnect: boolean) => void;
}

function componentCenter(component: React.Component<any, any>) {
  const domNode = findDOMNode(component) as Element;
  const box = domNode.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

// what a hack... :(
// react-dnd seems to completely block the mousemove event so the monitor seems to be
// the only way to get at the cursor position. It doesn't fire events on movement though
let cursorPosUpdater: NodeJS.Timeout;
let lastUpdatePos: { x: number, y: number } = { x: 0, y: 0 };
function updateCursorPos(monitor: DragSourceMonitor,
                         component: React.Component<any, any>,
                         onSetSource: (id: string, pos: { x: number, y: number }) => void,
                         onSetTarget: (id: string, pos: { x: number, y: number }) => void) {
  if (monitor.getClientOffset() !== null) {
    const curPos = monitor.getClientOffset();
    const dist = Math.abs(curPos.x - lastUpdatePos.x) + Math.abs(curPos.y - lastUpdatePos.y);
    if (dist > 2) {
      lastUpdatePos = curPos;
      onSetTarget(null, curPos);
    }
  }
  cursorPosUpdater = setTimeout(() =>
    updateCursorPos(monitor, component, onSetSource, onSetTarget), 50);
}

const transferSource: DragSourceSpec<IProps, any> = {
  beginDrag(props: IProps, monitor: DragSourceMonitor, component) {
    props.onSetHighlightGameId(props.profile.gameId);
    updateCursorPos(monitor, component, props.onSetSource, props.onSetTarget);
    return {
      id: props.profile.id,
    };
  },
  endDrag(props: IProps, monitor: DragSourceMonitor) {
    props.onSetHighlightGameId(undefined);
    clearTimeout(cursorPosUpdater);
    cursorPosUpdater = undefined;

    const source: IProfile = (monitor.getItem() as IProfile);
    props.onSetSource(source.id, undefined);

    if (monitor.getDropResult() === null) {
      return;
    }

    const destId: string = (monitor.getDropResult() as any).id;

    if (source.id !== destId) {
      props.onEditDialog(props.profile.gameId, source.id, destId);
    }
  },
  canDrag(props: IProps) {
    return !props.disabled;
  },
};

const transferTarget: DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: DropTargetMonitor, component) {
    return {
      id: props.profile.id,
    };
  },
};

function collectDrag(dragConnect: DragSourceConnector,
                     monitor: DragSourceMonitor): IDragProps {
  return {
    connectDragSource: dragConnect.dragSource(),
    connectDragPreview: dragConnect.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(dropConnect: DropTargetConnector,
                     monitor: DropTargetMonitor): IDropProps {
  const item: any = monitor.getItem();
  return {
    connectDropTarget: dropConnect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
    sourceId: item !== null ? item.id : undefined,
  };
}

class TransferIcon extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean;
  private mRef: JSX.Element;

  constructor(props: IProps) {
    super(props);

    this.initState({ showOverlay: false });
    this.mIsMounted = false;
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.props.connectDragPreview(getEmptyImage());
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.isDragging !== nextProps.isDragging) {
      let pos;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.profile.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      if ((this.props.profile.id !== nextProps.sourceId)
          && (nextProps.sourceId !== undefined)
          && (this.props.profile.gameId === this.props.profiles[nextProps.sourceId].gameId)) {
        let pos;
        if (nextProps.isOver) {
          pos = componentCenter(this);
        }
        nextProps.onSetTarget(nextProps.profile.id, pos);
      }
    }
  }

  public render(): JSX.Element {
    const { t, connectDragSource, connectDropTarget, disabled, profile } = this.props;

    const classes = ['btn-embed'];

    const popoverBlocks = [];

    if (popoverBlocks.length > 0) {
      classes.push('btn-transfer-hasOptions');
    } else {
      popoverBlocks.push(t('Drag to another profile to transfer settings.'));
    }
    const popover = (
      <Popover id={`popover-${profile.id}`} style={{ maxWidth: 500 }}>
      {popoverBlocks}
    </Popover>
    );

    const connectorIcon = connectDragSource((
        <div style={{ display: 'inline-block' }}>
          <tooltip.IconButton
            id={`btn-meta-data-${profile.id}`}
            disabled={disabled}
            className={classes.join(' ')}
            key={`rules-${profile.id}`}
            tooltip={t('Drag to another profile to transfer settings.')}
            icon='connection'
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
        ));

    return connectDropTarget((
      <div style={{ textAlign: 'center', display: 'inline-block' }}>
        {connectorIcon}
      </div>
    ));
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
}

const type = 'profile-transfer-icon';

const TransferIconDrag =
  DropTarget(type, transferTarget, collectDrop)(
    DragSource(type, transferSource, collectDrag)(
      TransferIcon));

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameId: selectors.activeGameId(state),
    profiles: state.persistent.profiles,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, source, target) =>
      dispatch(setCreateTransfer(gameId, source, target)),
  };
}

export default
  connect<IConnectedProps, IActionProps, IBaseProps>(mapStateToProps, mapDispatchToProps)(
      TransferIconDrag);
