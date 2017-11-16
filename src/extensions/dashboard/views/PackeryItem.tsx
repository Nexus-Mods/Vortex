import Icon from '../../../controls/Icon';

import {} from 'draggabilly';
import * as React from 'react';
import { Button } from 'react-bootstrap';

let Draggabilly: any;

export interface IProps {
  id: string;
  width: number;
  height: number;
  totalWidth?: number;
  packery?: any;
  fixed: boolean;
  onDismiss?: (id: string) => void;
}

class PackeryItem extends React.Component<IProps, {}> {
  private mRef: Element = null;

  public componentWillReceiveProps(newProps: IProps) {
    if (!newProps.fixed && (newProps.packery !== this.props.packery)) {
      this.makeDraggable(newProps);
    }
  }

  public render(): JSX.Element {
    const { onDismiss, fixed, height, id, totalWidth, width } = this.props;
    const widthPerc = Math.round((width / totalWidth) * 100);

    const classes = [
      'packery-item',
      `packery-height-${height}`,
    ];

    // we need two nested divs. The outer controls the width of
    // the item and it can't have a margin, otherwise the layout
    // would break.
    return (
      <div
        id={id}
        ref={this.setRef}
        style={{ width: `${widthPerc}%` }}
        className={classes.join(' ')}
      >
        {this.props.children}
        <div className='packery-buttons'>
          {!fixed ? <Icon name='zoom' className='drag-handle' /> : null}
          {(onDismiss !== undefined) ? (
            <Button
              className='btn-embed'
              onClick={this.dismissWidget}
            >
              <Icon name='cross' />
            </Button>
          ) : null}
        </div>
      </div>);
  }

  private dismissWidget = () => {
    return this.props.onDismiss(this.props.id);
  }

  private setRef = (ref) => {
    const { fixed } = this.props;
    this.mRef = ref;
    if (!fixed) {
      this.makeDraggable(this.props);
    }
  }

  private makeDraggable(props: IProps) {
    if ((this.mRef === null) || (props.packery === undefined)) {
      return;
    }

    if (Draggabilly === undefined) {
      Draggabilly = require('draggabilly');
    }
    props.packery.bindDraggabillyEvents(new Draggabilly(this.mRef, {
      handle: '.drag-handle',
    }));
  }
}

export default PackeryItem;
