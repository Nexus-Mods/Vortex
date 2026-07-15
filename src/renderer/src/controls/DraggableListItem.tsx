/* eslint-disable */
import React, { useCallback, useRef } from "react";
import { type DragSourceMonitor, useDrag, useDrop } from "react-dnd";

import { shouldReorder } from "./dragReorder";

export interface IDraggableListItemProps {
  disabled?: boolean;
  index: number;
  item: any;
  isLocked: boolean;
  itemRenderer: React.ComponentType<{
    className?: string;
    item: any;
    forwardedRef?: any;
  }>;
  containerId: string;
  isSelected: boolean;
  selectedItems: any[];
  draggedItems: any[];
  apply: () => void;
  findItemIndex: (item: any) => number;
  take: (item: any, list: any[]) => any;
  onChangeIndex: (
    oldIndex: number,
    newIndex: number,
    changeContainer: boolean,
    take: (list: any[]) => any,
  ) => void;
  onClick: (index: number, event: React.MouseEvent) => void;
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

  // collect must only return stable primitives: every row's collector runs on
  //  each drag-state change (every mousemove during a drag) and react-dnd
  //  re-renders the row whenever the collected object isn't shallow-equal.
  const [{ isDraggingItem }, drag, dragPreview] = useDrag(
    {
      type: containerId,
      item: () => {
        // Only the row a drag starts on needs the sorted selection.
        const sortedSelected = selectedItems
          .slice()
          .sort((a, b) => findItemIndex(a) - findItemIndex(b));
        const items = isSelected ? sortedSelected : [item];
        onDragStart(items);
        return {
          index,
          items,
          containerId,
          take: (list: any[]) => items.map((itm) => take(itm, list)),
        };
      },
      end: () => {
        apply();
      },
      canDrag: () => !isLocked && !disabled,
      collect: (monitor: DragSourceMonitor) => ({
        isDraggingItem: monitor.isDragging(),
      }),
    },
    [
      index,
      item,
      isSelected,
      selectedItems,
      findItemIndex,
      isLocked,
      disabled,
      containerId,
      onDragStart,
      take,
      apply,
    ],
  );

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

      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const hoverActualY = clientOffset.y - hoverBoundingRect.top;
      if (!shouldReorder(dragIndex, hoverIndex, hoverActualY, hoverMiddleY)) {
        return;
      }

      onChangeIndex(dragIndex, hoverIndex, sourceContainerId !== containerId, (list) =>
        items.map((item) => take(item, list)),
      );

      draggedItem.index = hoverIndex;
      if (sourceContainerId !== containerId) {
        draggedItem.containerId = containerId;
        draggedItem.take = (list: any[]) => take(items, list);
      }
    },
  });

  const classes = [];
  if (isSelected) {
    classes.push("selected");
  }
  if (isDraggingItem || draggedItems.indexOf(item) !== -1) {
    classes.push("dragging");
  }

  const draggedStyle: React.CSSProperties = {
    border:
      isDraggingItem && !isSelected && draggedItems.length === 0 ? "2px solid #A1A1AA" : undefined,
  };

  const setRef = useCallback(
    (ref: HTMLDivElement | null) => {
      itemRef.current = ref;
      drag(drop(ref));
    },
    [drag, drop],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => onClick(index, event),
    [onClick, index],
  );

  return (
    <div key={item.id} ref={dragPreview}>
      <div style={draggedStyle} ref={setRef} onClick={handleClick}>
        <ItemRendererComponent className={classes.join(" ")} item={item} />
      </div>
    </div>
  );
};

export default React.memo(DraggableItem);
