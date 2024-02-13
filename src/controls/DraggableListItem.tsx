import * as React from 'react';
import { ConnectDragPreview, ConnectDragSource,
         ConnectDropTarget, DragSource, DragSourceConnector,
         DragSourceMonitor, DragSourceSpec, DropTarget,
         DropTargetConnector, DropTargetMonitor, DropTargetSpec,
        } from 'react-dnd';
import * as ReactDOM from 'react-dom';

export interface IDraggableListItemProps {
  index: number;
  item: any;
  isLocked: boolean;
  itemRenderer: React.ComponentType<{ className?: string, item: any, forwardedRef?: any }>;
  containerId: string;
  take: (item: any, list: any[]) => any;
  onChangeIndex: (oldIndex: number, newIndex: number,
                  changeContainer: boolean, take: (list: any[]) => any) => void;
  apply: () => void;
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

type IProps = IDraggableListItemProps & IDragProps & IDropProps;

class DraggableItem extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { isDragging, item } = this.props;
    // Function components cannot be assigned a refrence - in cases like these
    //  we enhance the initial item to forward the setRef functor so that the
    //  item renderer itself can decide which DOM node to ref.
    const canReference = (this.props.itemRenderer.prototype?.render !== undefined);
    const refForwardedItem = (typeof item === 'object')
      ? { ...item, setRef: this.setRef }
      : { item, setRef: this.setRef };
    const ItemRendererComponent = this.props.itemRenderer;
    return (
      <ItemRendererComponent
        className={isDragging ? 'dragging' : undefined}
        item={canReference ? item : refForwardedItem}
        forwardedRef={canReference ? this.setRef : refForwardedItem.setRef}
      />
    );
  }

  private setRef = ref => {
    const { connectDragSource, connectDropTarget } = this.props;
    const node: any = ReactDOM.findDOMNode(ref);
    connectDragSource(node);
    connectDropTarget(node);
  }
}

function collectDrag(connect: DragSourceConnector,
                     monitor: DragSourceMonitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connect: DropTargetConnector,
                     monitor: DropTargetMonitor) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

const entrySource: DragSourceSpec<IProps, any> = {
  beginDrag(props: IProps) {
    return {
      index: props.index,
      item: props.item,
      containerId: props.containerId,
      take: (list: any[]) => props.take(props.item, list),
    };
  },
  endDrag(props, monitor: DragSourceMonitor) {
    props.apply();
  },
  canDrag(props, monitor: DragSourceMonitor) {
    return !props.isLocked;
  },
};

const entryTarget: DropTargetSpec<IProps> = {
  hover(props: IProps, monitor: DropTargetMonitor, component) {
    const { containerId, index, item, take, isLocked } = (monitor.getItem() as any);
    const hoverIndex = props.index;

    if ((index === hoverIndex) || !!isLocked || !!props.isLocked) {
      return;
    }

    const domNode: Element = ReactDOM.findDOMNode(component) as Element;
    if (domNode === null) {
      return;
    }
    const hoverBoundingRect = domNode.getBoundingClientRect();
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
    const clientOffset = monitor.getClientOffset();
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    if (((index < hoverIndex) && (hoverClientY < hoverMiddleY))
        || ((index > hoverIndex) && (hoverClientY > hoverMiddleY))) {
      return;
    }

    props.onChangeIndex(index, hoverIndex, containerId !== props.containerId, take);

    (monitor.getItem() as any).index = hoverIndex;
    if (containerId !== props.containerId) {
      (monitor.getItem() as any).containerId = props.containerId;
      (monitor.getItem() as any).take = (list: any[]) => props.take(item, list);
    }
  },
};

function makeDraggable(itemTypeId: string): React.ComponentClass<IDraggableListItemProps> {
  return DropTarget(itemTypeId, entryTarget, collectDrop)(
    DragSource(itemTypeId, entrySource, collectDrag)(
      DraggableItem));
}

export default makeDraggable;
