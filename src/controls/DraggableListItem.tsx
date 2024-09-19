/* eslint-disable */
import * as React from 'react';
import {
  ConnectDragPreview, ConnectDragSource,
  ConnectDropTarget, DragSource, DragSourceConnector,
  DragSourceMonitor, DragSourceSpec, DropTarget,
  DropTargetConnector, DropTargetMonitor, DropTargetSpec,
} from 'react-dnd';
import * as ReactDOM from 'react-dom';
import DraggableListDragPreview from './DraggableListDragPreview'; // Import the updated preview component

export interface IDraggableListItemProps {
  index: number;
  item: any;
  isLocked: boolean;
  itemRenderer: React.ComponentType<{ className?: string, item: any, forwardedRef?: any }>;
  containerId: string;
  isSelected: boolean;
  selectedItems: any[];
  draggedItems: any[];
  apply: () => void;
  findItemIndex: (item: any) => number;
  take: (item: any, list: any[]) => any;
  onChangeIndex: (oldIndex: number, newIndex: number, changeContainer: boolean, take: (list: any[]) => any) => void;
  onClick: (event: React.MouseEvent) => void;
  onDragStart: (items: any[]) => void;
}

interface IDragProps {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview; // Connect drag preview
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
    const { item, draggedItems, isDragging, isSelected, connectDragPreview, itemRenderer } = this.props;
    const refForwardedItem = (typeof item === 'object')
      ? { ...item, setRef: this.setRef }
      : { item, setRef: this.setRef };

    // Not to be mistaken for the isDragging flag - that is only raised for the initial entry that
    //  is being dragged. isDraggedItem is used for visual configuration, while isDragging modifies
    //  functionality (The custom drag preview component only gets attached to the initial entry)
    const isDraggedItem = draggedItems.includes(item);

    const classes = isSelected
      ? isDraggedItem
        ? ['dragging', 'selected']
        : ['selected']
      : isDraggedItem ? ['dragging'] : [];

    const dragPreview = isDragging
      ? <DraggableListDragPreview items={draggedItems} itemRenderer={itemRenderer} />
      : null;

    const ItemRendererComponent = this.props.itemRenderer;
    const renderItemComponent = (!isDragging)
      ? (
        <ItemRendererComponent
          className={`${classes.join(' ')}`}
          item={refForwardedItem}
        />
      ) : null;

    return connectDragPreview(
      <div ref={this.setRef} onClick={this.props.onClick}>
        {dragPreview}
        {renderItemComponent}
      </div>
    );
  }

  private setRef = ref => {
    const { connectDragSource, connectDropTarget } = this.props;
    const node: any = ReactDOM.findDOMNode(ref);
    connectDragSource(node);
    connectDropTarget(node);
  }
}

const entrySource: DragSourceSpec<IProps, any> = {
  beginDrag(props: IProps, monitor: DragSourceMonitor) {
    const draggedItems = props.isSelected ? props.selectedItems : [props.item];
    props.onDragStart(draggedItems);
    return {
      index: props.index,
      items: draggedItems,
      containerId: props.containerId,
      take: (list: any[]) => draggedItems.map(item => props.take(item, list)),
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
    const { containerId, index, items, isLocked } = (monitor.getItem() as any);
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

    props.onChangeIndex(index, hoverIndex, containerId !== props.containerId, (list) => items.map(item => props.take(item, list)));

    (monitor.getItem() as any).index = hoverIndex;
    if (containerId !== props.containerId) {
      (monitor.getItem() as any).containerId = props.containerId;
      (monitor.getItem() as any).take = (list: any[]) => props.take(items, list);
    }
  },
};

function collectDrag(connect: DragSourceConnector, monitor: DragSourceMonitor) {
  return {
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connect: DropTargetConnector, monitor: DropTargetMonitor) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

function makeDraggable(itemTypeId: string): React.ComponentClass<IDraggableListItemProps> {
  return DropTarget(itemTypeId, entryTarget, collectDrop)(
    DragSource(itemTypeId, entrySource, collectDrag)(
      DraggableItem));
}

export default makeDraggable;