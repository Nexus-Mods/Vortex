import React, { FC, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import Icon from '../../controls/Icon';
import { IStarterInfo } from '../../util/StarterInfo';

interface IProps {
  children?: any;
  className?: string;
  item: IStarterInfo;
  index: number;
  onMoveItem: (id: string, id2: string) => void;
}

export const BoxWithHandle: FC<IProps> = (props: IProps) => {
  const [{ opacity, isDragging }, drag, dragPreview] = useDrag({
    type: 'TOOL',
    item: { idx: props.index, id: props.item.id },
    collect: (monitor) => {
      return {
        isDragging: monitor.isDragging(),
        opacity: monitor.isDragging() ? 0.4 : 1,
      };
    },
  });
  const ref = useRef(null)
  const [spec, dropRef] = useDrop({
    accept: 'TOOL',
    hover: (hoveredOverItem: any, monitor) => {
      const dragIdx = props.index;
      const hoverIdx = hoveredOverItem.index;
      if (dragIdx === hoverIdx) {
        return;
      }
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const hoverActualY = monitor.getClientOffset().y - hoverBoundingRect.top
      // if dragging down, continue only when hover is smaller than middle Y
      if (dragIdx < hoverIdx && hoverActualY < hoverMiddleY) return
      // if dragging up, continue only when hover is bigger than middle Y
      if (dragIdx > hoverIdx && hoverActualY > hoverMiddleY) return
      props.onMoveItem(hoveredOverItem.id, props.item.id);
    },
  })

const dragDropRef = drag(dropRef(ref))
  const children = Array.isArray(props.children)
    ? props.children : [props.children];
  return (
    <div className='box-drag-handle-container' ref={dragPreview} style={{ opacity }}>
      <div className='box-drag-handle' ref={dragDropRef as any} >
        <Icon className='box-drag-handle-icon' name='drag-handle' />
      </div>
      {...children}
    </div>
  );
};
