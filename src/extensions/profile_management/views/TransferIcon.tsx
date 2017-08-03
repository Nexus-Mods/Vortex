import { setCreateTransfer, setSource, setTarget } from '../actions/transferSetup';

import { ComponentEx } from '../../../util/ComponentEx';
import * as tooltip from '../../../views/TooltipControls';
import * as selectors from '../selectors';

import { IProfile } from '../types/IProfile';

import * as I18next from 'i18next';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { findDOMNode } from 'react-dom';
import { connect } from 'react-redux';

import { log } from '../../../util/log';

let sourceProfile: IProfile;

function splitOnce(input: string, separator: string): string[] {
  const idx = input.indexOf(separator);
  return [input.slice(0, idx), input.slice(idx + 1)];
}

export interface IBaseProps {
  profile: IProfile;
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  gameId: string;
}

interface IActionProps {
  onSetSource: (id: string, pos: { x: number, y: number }) => void;
  onSetTarget: (id: string, pos: { x: number, y: number }) => void;
  onEditDialog: (gameId: string, referenceId: string,
                 reference: string, defaultType: string) => void;
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

const transferSource: __ReactDnd.DragSourceSpec<IProps> = {
  beginDrag(props: IProps, monitor: __ReactDnd.DragSourceMonitor, component) {
    updateCursorPos(monitor, component, props.onSetSource, props.onSetTarget);
    sourceProfile = props.profile;
    return {
      id: props.profile.id,
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
      props.onEditDialog(props.profile.gameId, source, dest, 'after');
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
  return {
    connectDropTarget: dropConnect.dropTarget(),
    isOver: monitor.isOver(),
    canDrop: monitor.canDrop(),
  };
}

class TransferIcon extends ComponentEx<IProps, IComponentState> {
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
      nextProps.onSetSource(nextProps.profile.id, pos);
    } else if (this.props.isOver !== nextProps.isOver) {
      if (this.props.profile.gameId === sourceProfile.gameId) {
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

    const classes = ['btn-transfer'];

    const popoverBlocks = [];

    if (popoverBlocks.length > 0) {
      classes.push('btn-transfer-hasrules');
    } else {
      popoverBlocks.push(t('Drag to another connector to start a profile transfer.'));
    }
    const popover = (
      <Popover id={`popover-${profile.id}`} style={{ maxWidth: 500 }}>
      {popoverBlocks}
    </Popover>
    );

    const connectorIcon = connectDragSource(
        <div style={{ display: 'inline' }}>
          <tooltip.IconButton
            id={`btn-meta-data-${profile.id}`}
            className={classes.join(' ')}
            key={`rules-${profile.id}`}
            tooltip={t('Drag to profile to start the transfer')}
            icon='export'
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

function mapStateToProps(state): IConnectedProps {
  return {
    gameId: selectors.activeGameId(state),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSource: (id, pos) => dispatch(setSource(id, pos)),
    onSetTarget: (id, pos) => dispatch(setTarget(id, pos)),
    onEditDialog: (gameId, profileId, reference, defaultType) =>
      dispatch(setCreateTransfer(gameId, profileId, reference, defaultType)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
      TransferIconDrag) as React.ComponentClass<IBaseProps>;
