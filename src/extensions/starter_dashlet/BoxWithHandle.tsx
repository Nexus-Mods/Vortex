import React, { CSSProperties, FC, memo } from 'react';
import { useDrag } from 'react-dnd';
import Icon from '../../controls/Icon';
import { StarterInfo } from '../../util/api';

interface IProps {
  children?: any;
  className?: string;
  item: StarterInfo;
}

export const BoxWithHandle: FC<IProps> = memo((props: IProps) => {
  const [{ opacity, isDragging }, drag, dragPreview] = useDrag({
    item: { id: props.item.id, type: 'TOOL' },
    collect: (monitor) => {
      return {
        isDragging: monitor.isDragging(),
        opacity: monitor.isDragging() ? 0.4 : 1,
      };
    },
  });
  const children = Array.isArray(props.children)
    ? props.children : [props.children];
  return (
    <div className='starter-drag-handle-container' ref={dragPreview} style={{ opacity }}>
      <div className='starter-drag-handle' ref={drag as any} >
        <Icon className='starter-drag-handle-icon' name='drag-handle' />
      </div>
      {...children}
    </div>
  );
});
