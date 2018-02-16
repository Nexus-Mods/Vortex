import * as React from 'react';
import { ListGroupItem } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import * as ReactDOM from 'react-dom';

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

export interface IPluginEntryProps {
  plugin: string;
  index: number;
  onChangeIndex: (oldIndex: number, newIndex: number) => void;
}

type IProps = IPluginEntryProps & IDragProps & IDropProps;

const entrySource: __ReactDnd.DragSourceSpec<IProps> = {
  beginDrag(props: IProps) {
    return {
      id: props.plugin,
      idx: props.index,
    };
  },
};

const entryTarget: __ReactDnd.DropTargetSpec<IProps> = {
  hover(props: IProps, monitor: __ReactDnd.DropTargetMonitor, component) {
    const dragIndex = (monitor.getItem() as any).index;
    const hoverIndex = props.index;

    // Don't replace items with themselves
    if (dragIndex === hoverIndex) {
      return;
    }

    const hoverBoundingRect = ReactDOM.findDOMNode(component).getBoundingClientRect();
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
    const clientOffset = monitor.getClientOffset();
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    if (((dragIndex < hoverIndex) && (hoverClientY < hoverMiddleY))
        || ((dragIndex > hoverIndex) && (hoverClientY > hoverMiddleY))) {
      return;
    }

    props.onChangeIndex(dragIndex, hoverIndex);

    (monitor.getItem() as any).index = hoverIndex;
  },
};

class PluginEntry extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { plugin, isDragging, connectDragSource, connectDropTarget } = this.props;

    return connectDragSource(
      connectDropTarget(
        <ListGroupItem key={plugin}>
          {plugin}
        </ListGroupItem>));
  }
}

const type = 'morrowind-plugin-entry';

function collectDrag(connect: __ReactDnd.DragSourceConnector,
                     monitor: __ReactDnd.DragSourceMonitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connect: __ReactDnd.DropTargetConnector,
                     monitor: __ReactDnd.DropTargetMonitor) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

export default DropTarget(type, entryTarget, collectDrop)(
    DragSource(type, entrySource, collectDrag)(
      PluginEntry));
