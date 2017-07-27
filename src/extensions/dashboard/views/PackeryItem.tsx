import {} from 'draggabilly';
import * as React from 'react';

let Draggabilly: any;

export interface IProps {
  id: string;
  width: number;
  height: number;
  totalWidth?: number;
  packery?: any;
}

class PackeryItem extends React.Component<IProps, {}> {
  private mRef: Element = null;

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.packery !== this.props.packery) {
      this.makeDraggable(newProps);
    }
  }

  public render(): JSX.Element {
    const { height, id, totalWidth, width } = this.props;
    const widthPerc = Math.floor((width / totalWidth) * 100);
    // we need two nested divs. The outer controls the width of
    // the item and it can't have a margin, otherwise the layout
    // would break.
    return (
      <div
        id={id}
        ref={this.setRef}
        style={{ width: `${widthPerc}%` }}
        className={`packery-item packery-height-${height}`}
      >
        {this.props.children}
      </div>);
  }

  private setRef = (ref) => {
    this.mRef = ref;
    this.makeDraggable(this.props);
  }

  private makeDraggable(props: IProps) {
    if ((this.mRef === null) || (props.packery === undefined)) {
      return;
    }

    if (Draggabilly === undefined) {
      Draggabilly = require('Draggabilly');
    }
    props.packery.bindDraggabillyEvents(new Draggabilly(this.mRef));
  }
}

export default PackeryItem;
