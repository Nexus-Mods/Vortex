import * as React from 'react';
import { ListGroup } from 'react-bootstrap';
import {
  ConnectDropTarget, DropTarget, DropTargetConnector, DropTargetMonitor,
  DropTargetSpec,
} from 'react-dnd';
import { ComponentEx } from '../util/ComponentEx';
import makeDraggable, { IDraggableListItemProps } from './DraggableListItem';

export interface IDraggableListProps {
  id: string;
  itemTypeId: string;
  items: any[];
  isLocked?: (item: any) => boolean;
  idFunc?: (item: any) => string;
  itemRenderer: React.ComponentClass<{ item: any }>;
  apply: (ordered: any[]) => void;
  style?: React.CSSProperties;
  className?: string;
}

interface IDraggableListState {
  ordered: any[];
}

type IProps = IDraggableListProps & { connectDropTarget: ConnectDropTarget };

/**
 * A list component that allows the user to manually re-order the items
 * in it.
 * It also allows items to be dragged into another list.
 *
 * Important: items has to either be a string, a number, an object with an "id" field or you have
 *   to specify idFunc through props
 */
class DraggableList extends ComponentEx<IProps, IDraggableListState> {
  private mDraggableClass: React.ComponentClass<IDraggableListItemProps>;

  constructor(props: IProps) {
    super(props);

    this.initState({
      ordered: props.items.slice(0),
    });

    this.mDraggableClass = makeDraggable(props.itemTypeId);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.items !== newProps.items) {
      this.nextState.ordered = newProps.items.slice(0);
    }
  }

  public render(): JSX.Element {
    const { connectDropTarget, id, isLocked, itemRenderer, style, className } = this.props;

    const { ordered } = this.state;
    return connectDropTarget(
      <div style={style} className={className}>
        <ListGroup>
          {ordered.map((item, idx) => (
              <this.mDraggableClass
                containerId={id}
                key={this.itemId(item)}
                item={item}
                index={idx}
                isLocked={isLocked?.(item) ?? false}
                itemRenderer={itemRenderer}
                take={this.take}
                onChangeIndex={this.changeIndex}
                apply={this.apply}
              />
            ))}
        </ListGroup>
      </div>);
  }

  public changeIndex = (oldIndex: number, newIndex: number, changeContainer: boolean,
                        take: (list: any[]) => any) => {
    if (oldIndex === undefined) {
      return;
    }

    const copy = this.state.ordered.slice();
    const item = take(changeContainer ? undefined : copy);
    copy.splice(newIndex, 0, item);

    this.nextState.ordered = copy;
  }

  private itemId(item: any) {
    if (this.props.idFunc !== undefined) {
      return this.props.idFunc(item);
    } else if (item.id !== undefined) {
      return item.id;
    } else {
      return item;
    }
  }

  private take = (item: any, list: any[]) => {
    const { ordered } = this.nextState;
    let res = item;
    const itemId = this.itemId(item);
    const index = ordered.findIndex(iter => this.itemId(iter) === itemId);
    if (index !== -1) {
      if (list !== undefined) {
        res = list.splice(index, 1)[0];
      } else {
        const copy = ordered.slice();
        res = copy.splice(index, 1)[0];
        this.nextState.ordered = copy;
      }
    }
    return res;
  }

  private apply = () => {
    this.props.apply(this.state.ordered);
  }
}

const containerTarget: DropTargetSpec<IProps> = {
  hover(props: IProps, monitor: DropTargetMonitor, component) {
    const { containerId, index, item, take } = (monitor.getItem() as any);

    if (containerId !== props.id) {
      (component as any).changeIndex(index, 0, true, take);

      (monitor.getItem() as any).index = 0;
      (monitor.getItem() as any).containerId = props.id;
      (monitor.getItem() as any).take = (list) => (component as any).take(item, list);
    }
  },
};

function containerCollect(connect: DropTargetConnector,
                          monitor: DropTargetMonitor) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

const classCache: { [itemTypeId: string]: React.ComponentClass<IDraggableListProps> } = {};

function DraggableListWrapper(props: IDraggableListProps) {
  if (classCache[props.itemTypeId] === undefined) {
    classCache[props.itemTypeId] =
      DropTarget(props.itemTypeId, containerTarget, containerCollect)(DraggableList);
  }

  const Clss = classCache[props.itemTypeId];
  return (
    <Clss {...props} />
  );
}

export default DraggableListWrapper;
