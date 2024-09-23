/* eslint-disable */
import React, { useCallback, useRef } from 'react';
import { DragSourceMonitor, useDrag, useDrop } from 'react-dnd';

export interface IDraggableListItemProps {
  index: number;
  item: any;
  isLocked: boolean;
  itemRenderer: React.ComponentType<{ className?: string; item: any; forwardedRef?: any }>;
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

const DraggableItem: React.FC<IDraggableListItemProps> = ({
  index,
  item,
  draggedItems,
  isSelected,
  itemRenderer: ItemRendererComponent,
  onClick,
  containerId,
  isLocked,
  onChangeIndex,
  onDragStart,
  selectedItems,
  take,
  apply,
}) => {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [ startedDrag, setStartedDrag ] = React.useState(false);

  const isDraggedItem = draggedItems.includes(item);
  const classes = isSelected
    ? isDraggedItem
      ? ['dragging', 'selected']
      : ['selected']
    : isDraggedItem
    ? ['dragging']
    : [];

  const [{ isDraggingItem, draggedStyle }, drag, dragPreview] = useDrag({
    type: containerId,
    item: {
      index,
      items: isSelected ? selectedItems : [item],
      containerId,
      take: (list: any[]) => (isSelected ? selectedItems : [item]).map((item) => take(item, list)),
    },
    end: () => {
      apply();
    },
    canDrag: () => !isLocked,
    collect: (monitor: DragSourceMonitor) => {
      if (monitor.isDragging() && !startedDrag) {
        onDragStart(draggedItems);
        setStartedDrag(true);
      }
      return {
        isDraggingItem: monitor.isDragging(),
        draggedStyle: {
          visibility: 'visible',
          border: monitor.isDragging() && !isSelected ? '2px solid white' : undefined,
        } as React.CSSProperties,
      }
    },
  }, [startedDrag]);

  const [, drop] = useDrop({
    accept: containerId,
    hover: (draggedItem: any, monitor) => {
      const { index: dragIndex, items, containerId: sourceContainerId } = draggedItem;
      const hoverIndex = index;

      if (dragIndex === hoverIndex || isLocked || monitor.isOver({ shallow: true })) {
        return;
      }

      const hoverBoundingRect = itemRef.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const hoverActualY = monitor.getClientOffset().y - hoverBoundingRect.top
      // if dragging down, continue only when hover is smaller than middle Y
      if (index < hoverIndex && hoverActualY < hoverMiddleY) return
      // if dragging up, continue only when hover is bigger than middle Y
      if (index > hoverIndex && hoverActualY > hoverMiddleY) return

      onChangeIndex(dragIndex, hoverIndex, sourceContainerId !== containerId, (list) =>
        items.map((item) => take(item, list))
      );

      draggedItem.index = hoverIndex;
      if (sourceContainerId !== containerId) {
        draggedItem.containerId = containerId;
        draggedItem.take = (list: any[]) => take(items, list);
      }
    },
    drop(item, monitor) {
      setStartedDrag(false);
      return undefined;
    },
  });

  const setRef = useCallback((ref: HTMLDivElement | null) => {
    itemRef.current = ref;
    drag(drop(ref));
  }, [drag, drop]);

  return (
    <div ref={dragPreview}>
      <div style={draggedStyle} ref={setRef} onClick={onClick}>
        <ItemRendererComponent className={classes.join(' ')} item={item} />
      </div>
    </div>
  );
};

export default DraggableItem;
