import Icon from './Icon';

import * as React from 'react';
import {OverlayTrigger, Popover} from 'react-bootstrap';

export interface IProps {
  id: string;
  name: string;
  children?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Component to make additional information available to the user without taking much
 * space. The user only sees a clickable question mark. On click it will show a popover
 * with the info.
 *
 * double-linebreaks can be used in the text to start a new paragraph.
 *
 * @param {IProps} props
 * @returns
 */
function More(props: IProps) {
  const { children, id, name, placement } = props;
  let pCounter = 0;
  const popover = (
    <Popover id={`popover-${id}`} className='more-popover' title={name}>
      {children.split('\n\n').map((paragraph) => <p key={pCounter++}>{paragraph}</p>)}
    </Popover>
  );
  return (
    <OverlayTrigger
      trigger='click'
      rootClose
      placement={ placement || 'bottom' }
      overlay={popover}
    >
      <div style={{ display: 'inline', margin: 2 }}>
        <Icon name='question-circle' className='more-link' />
      </div>
    </OverlayTrigger>
  );
}

export default More;
