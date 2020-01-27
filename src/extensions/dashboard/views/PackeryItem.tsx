import ContextMenu from '../../../controls/ContextMenu';
import Icon from '../../../controls/Icon';

import {} from 'draggabilly';
import update from 'immutability-helper';
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
  onSetWidth?: (id: string, width: number) => void;
  onSetHeight?: (id: string, height: number) => void;
}

interface IPackeryItemState {
  context: {
    x: number;
    y: number;
  };
}

class PackeryItem extends React.Component<IProps, IPackeryItemState> {
  private mRef: Element = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      context: undefined,
    };
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (!newProps.fixed && (newProps.packery !== this.props.packery)) {
      this.makeDraggable(newProps);
    }
  }

  public render(): JSX.Element {
    const { onDismiss, fixed, height, id, totalWidth, width } = this.props;
    // round to 2 positions after decimal point. It's fairly noticable if
    // widgets don't align even by a few pixels
    const widthPerc = Math.round(((width * 10000) / totalWidth)) / 100;

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
          {!fixed ? this.renderDragHandle() : null}
          {(onDismiss !== undefined) ? (
            <Button
              className='btn-embed'
              onClick={this.dismissWidget}
            >
              <Icon name='close-slim' />
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  private renderDragHandle() {
    return [(
      <Icon
        key='drag-icon'
        name='drag-handle'
        className='drag-handle'
        onContextMenu={this.onContext}
      />
    ), (
        <ContextMenu
          key='drag-context'
          position={this.state.context}
          visible={this.state.context !== undefined}
          onHide={this.hideContext}
          instanceId='42'
          actions={[
            { title: 'Width', icon: null, show: true },
            { title: '33%', show: true, action: this.setWidth1 },
            { title: '66%', show: true, action: this.setWidth2 },
            { title: '100%', show: true, action: this.setWidth3 },
            { title: 'Height', icon: null, show: true },
            { title: '1', show: true, action: this.setHeight1 },
            { title: '2', show: true, action: this.setHeight2 },
            { title: '3', show: true, action: this.setHeight3 },
            { title: '4', show: true, action: this.setHeight4 },
            { title: '5', show: true, action: this.setHeight5 },
          ]}
        />
      )];
  }

  private setWidth1 = () => {
    this.props.onSetWidth(this.props.id, 1);
  }

  private setWidth2 = () => {
    this.props.onSetWidth(this.props.id, 2);
  }

  private setWidth3 = () => {
    this.props.onSetWidth(this.props.id, 3);
  }

  private setHeight1 = () => {
    this.props.onSetHeight(this.props.id, 1);
  }

  private setHeight2 = () => {
    this.props.onSetHeight(this.props.id, 2);
  }

  private setHeight3 = () => {
    this.props.onSetHeight(this.props.id, 3);
  }

  private setHeight4 = () => {
    this.props.onSetHeight(this.props.id, 4);
  }

  private setHeight5 = () => {
    this.props.onSetHeight(this.props.id, 5);
  }

  private onContext = (event: React.MouseEvent<any>) => {
    this.setState(update(this.state, {
      context: { $set: {
        x: event.clientX, y: event.clientY,
      } } }));
  }

  private hideContext = () => {
    this.setState({ context: undefined });
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
