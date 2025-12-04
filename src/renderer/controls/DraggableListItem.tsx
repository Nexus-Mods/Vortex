/* eslint-disable */
import React, { useCallback, useRef } from 'react';
import { DragSourceMonitor, useDrag, useDrop } from 'react-dnd';

export interface IDraggableListItemProps {
  disabled?: boolean
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
  disabled,
  index,
  item,
  draggedItems,
  findItemIndex,
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

  const sortByIndex = (list: any[]) => list.sort((a, b) => findItemIndex(a) - findItemIndex(b));

  const isDraggedItem = React.useCallback(() => findItemIndex(item) !== -1, [draggedItems]);
  const classes = isSelected ? ['selected'] : [];

  const sortedSelected = React.useMemo(() => sortByIndex(selectedItems), [selectedItems]);

  const [{ isDraggingItem, draggedStyle }, drag, dragPreview] = useDrag({
    type: containerId,
    item: {
      index,
      items: isSelected ? sortedSelected : [item],
      containerId,
      take: (list: any[]) => (sortedSelected).map((item) => take(item, list)),
    },
    end: () => {
      apply();
    },
    canDrag: () => !isLocked && !disabled,

    collect: (monitor: DragSourceMonitor) => {
      if (isDraggedItem() && !startedDrag) {
        onDragStart(sortedSelected);
        setStartedDrag(true);
      }

      if (isDraggedItem() && !classes.includes('dragging')) {
        classes.push('dragging');
      }

      return {
        isDraggingItem: monitor.isDragging(),
        draggedStyle: {
          border: monitor.isDragging() && !isSelected && draggedItems.length === 0 ? '2px solid #A1A1AA' : undefined,
        } as React.CSSProperties,
      }
    },
  }, [startedDrag, sortedSelected, isSelected]);

  const [, drop] = useDrop({
    accept: containerId,
    hover: (draggedItem: any, monitor) => {
      const { index: dragIndex, items, containerId: sourceContainerId } = draggedItem;
      const hoverIndex = index;
      if (dragIndex === hoverIndex || isLocked || disabled || monitor.isOver({ shallow: true })) {
        return;
      }

      const hoverBoundingRect = itemRef.current?.getBoundingClientRect();
      if (!hoverBoundingRect) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const hoverActualY = clientOffset.y - hoverBoundingRect.top
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
    <div key={item.id} ref={dragPreview}>
      <div style={draggedStyle} ref={setRef} onClick={onClick}>
        <ItemRendererComponent className={classes.join(' ')} item={item} />
      </div>
    </div>
  );
};

export default DraggableItem;
