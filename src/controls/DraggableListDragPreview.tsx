/* eslint-disable */
import * as React from 'react';

interface IDragPreviewProps {
  className?: string;
  items: any[];
  itemRenderer: React.ComponentType<{ className?: string, item: any, forwardedRef?: any }>;
}

const DraggableListDragPreview: React.FC<IDragPreviewProps> = ({ items, itemRenderer, className }) => {
  const classes = ['draggable-list-drag-preview'];
  if (!!className) {
    classes.push(className);
  }

  return (
    <div id='draggable-list-drag-preview' className={classes.join(' ')}>
      {items.map((item, index) => (
        <div key={index}>
          {React.createElement(itemRenderer, { item, className: 'draggable-list-drag-preview-item' })}
        </div>
      ))}
    </div>
  );
};

export default DraggableListDragPreview;
