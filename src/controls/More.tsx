import Icon from './Icon';
import Overlay from './Overlay';

import * as React from 'react';
import {Popover} from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IProps {
  id: string;
  name: string;
  children?: string;
  container?: Element;
  orientation?: 'vertical' | 'horizontal';
}

export interface IComponentState {
  open: boolean;
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
class More extends React.Component<IProps, IComponentState> {

  private mPopoverRef: Element;
  private mRef: Element;

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { children, id, name, orientation } = this.props;
    const { open } = this.state;

    if (children === undefined) {
      return null;
    }

    let pCounter = 0;
    const popover = (
      <Popover id={`popover-${id}`} className='more-popover' title={name}>
        {children.split('\n\n').map((paragraph) => <p key={pCounter++}>{paragraph}</p>)}
      </Popover>
    );
    return (
      <div style={{ display: 'inline' }}>
        <Overlay
          rootClose
          show={open}
          onHide={this.hide}
          orientation={orientation}
          target={this.getRef}
          getBounds={this.getBounds}
        >
          {popover}
        </Overlay>
        <sup className='more-link' ref={this.setRef}>
          <a onClick={this.toggle}>?</a>
        </sup>
      </div>
    );
  }

  private getRef = () => this.mRef;

  private setRef = ref => {
    this.mRef = ref;
  }

  private toggle = evt => {
    evt.preventDefault();
    this.setState({ open: !this.state.open });
  }

  private hide = () => {
    this.setState({ open: false });
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
