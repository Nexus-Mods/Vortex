import Icon from './Icon';
import OverlayTrigger from './OverlayTrigger';

import * as React from 'react';
import {Popover} from 'react-bootstrap';

export interface IProps {
  id: string;
  name: string;
  children?: string;
  container?: Element;
  orientation?: 'vertical' | 'horizontal';
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
class More extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { children, id, name, orientation } = this.props;
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
        overlay={popover}
        getBounds={this.getBounds}
        orientation={orientation}
      >
        <sup className='more-link'>
          ?
        </sup>
      </OverlayTrigger>
    );
  }

  private getBounds = (): ClientRect => {
    const { container } = this.props;

    return container !== undefined ? container.getBoundingClientRect() : {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
  }
}

export default More;
