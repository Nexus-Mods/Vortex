import * as tooltip from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { ComponentEx } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import * as selectors from '../selectors';

import { setCreateTransfer, setSource, setTarget } from '../actions/transferSetup';
import { IProfile } from '../types/IProfile';

import * as I18next from 'i18next';
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
  profile: IProfile;
  t: I18next.TranslationFunction;
  onSetHighlightGameId: (gameId: string) => void;
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
  connectDragSource: __ReactDnd.ConnectDragSource;
  connectDragPreview: __ReactDnd.ConnectDragPreview;
  isDragging: boolean;
}

interface IDropProps {
  connectDropTarget: __ReactDnd.ConnectDropTarget;
  isOver: boolean;
  canDrop: boolean;
  sourceId: string;
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
      lastUpdatePos = curPos;
      onSetTarget(null, curPos);
    }
  }
  cursorPosUpdater = setTimeout(() =>
    updateCursorPos(monitor, component, onSetSource, onSetTarget), 50);
}

const transferSource: __ReactDnd.DragSourceSpec<IProps> = {
  beginDrag(props: IProps, monitor: __ReactDnd.DragSourceMonitor, component) {
    props.onSetHighlightGameId(props.profile.gameId);
    updateCursorPos(monitor, component, props.onSetSource, props.onSetTarget);
    return {
      id: props.profile.id,
    };
  },
  endDrag(props: IProps, monitor: __ReactDnd.DragSourceMonitor) {
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
};

const transferTarget: __ReactDnd.DropTargetSpec<IProps> = {
  drop(props: IProps, monitor: __ReactDnd.DropTargetMonitor, component) {
    return {
      id: props.profile.id,
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

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.isDragging !== nextProps.isDragging) {
      let pos;
      if (nextProps.isDragging) {
        pos = componentCenter(this);
      }
      nextProps.onSetSource(nextProps.profile.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      if ((this.props.profile.id !== nextProps.sourceId)
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
    const { t, connectDragSource, connectDropTarget, profile } = this.props;

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

    const connectorIcon = connectDragSource(
        <div style={{ display: 'inline-block' }}>
          <tooltip.IconButton
            id={`btn-meta-data-${profile.id}`}
            className={classes.join(' ')}
            key={`rules-${profile.id}`}
            tooltip={t('Drag to profile to start the transfer')}
            icon='import'
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
      <div style={{ textAlign: 'center', display: 'inline-block' }}>
        {connectorIcon}
      </div>);
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
  connect(mapStateToProps, mapDispatchToProps)(
      TransferIconDrag) as React.ComponentClass<IBaseProps>;
