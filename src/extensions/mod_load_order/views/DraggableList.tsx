import Promise from 'bluebird';
import * as React from 'react';
import { ListGroup } from 'react-bootstrap';
import { ConnectDragPreview,  ConnectDragSource, ConnectDropTarget, DragSource,
  DragSourceConnector, DragSourceMonitor, DragSourceSpec,
  DropTarget, DropTargetConnector, DropTargetMonitor, DropTargetSpec } from 'react-dnd';

import * as ReactDOM from 'react-dom';
import { ComponentEx, util } from 'vortex-api';
import { IDnDConditionResult, ILoadOrderDisplayItem } from '../types/types';

interface IItemBaseProps {
  index: number;
  item: ILoadOrderDisplayItem;
  itemRenderer: React.ComponentClass<{
    className?: string,
    item: ILoadOrderDisplayItem,
    onRef: (ref: any) => any }>;
  containerId: string;
  take: (item: ILoadOrderDisplayItem, list: ILoadOrderDisplayItem[]) => any;
  onChangeIndex: (oldIndex: number, newIndex: number,
                  take: (list: ILoadOrderDisplayItem[]) => any) => void;
  apply: () => void;
}

interface IDragProps {
  connectDragSource: ConnectDragSource;
  connectDragPreview: ConnectDragPreview;
  isDragging: boolean;
}

interface IDropProps {
  connectDropTarget: ConnectDropTarget;
  isOver: boolean;
  canDrop: boolean;
}

type IItemProps = IItemBaseProps & IDragProps & IDropProps;

class DraggableItem extends React.Component<IItemProps, {}> {
  public render(): JSX.Element {
    const { isDragging, item } = this.props;
    const classNames = [].concat(!!item.locked ? 'locked' : undefined,
                                 !!item.external ? 'external' : undefined,
                                  isDragging ? 'dragging' : undefined);

    return (
      <this.props.itemRenderer
        className={classNames.filter(name => !!name).join(' ')}
        item={item}
        onRef={this.setRef}
      />
    );
  }

  private setRef = (ref: any) => {
    const { connectDragSource, connectDropTarget } = this.props;
    const node: any = ReactDOM.findDOMNode(ref);
    connectDragSource(node);
    connectDropTarget(node);
  }
}

const DND_TYPE = 'load-order-entry';

function collectDrag(connect: DragSourceConnector,
                     monitor: DragSourceMonitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connect: DropTargetConnector,
                     monitor: DropTargetMonitor) {
  return {
    connectDropTarget: connect.dropTarget(),
  };
}

const entrySource: DragSourceSpec<IItemProps, any> = {
  beginDrag(props: IItemProps) {
    return {
      index: props.index,
      item: props.item,
      containerId: props.containerId,
      take: (list: any[]) => props.take(props.item, list),
    };
  },
  endDrag(props, monitor: DragSourceMonitor) {
    props.apply();
  },
};

const entryTarget: DropTargetSpec<IItemProps> = {
  hover(props: IItemProps, monitor: DropTargetMonitor, component) {
    const { containerId, index, item, take } = (monitor.getItem() as any);
    const hoverIndex = props.index;

    if (index === hoverIndex || !!item.locked) {
      return;
    }

    const domNode = ReactDOM.findDOMNode(component);
    if (domNode === null) {
      return;
    }
    const hoverBoundingRect = (domNode as any).getBoundingClientRect();
    const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
    const clientOffset = monitor.getClientOffset();
    const hoverClientY = clientOffset.y - hoverBoundingRect.top;

    if (((index < hoverIndex) && (hoverClientY < hoverMiddleY))
        || ((index > hoverIndex) && (hoverClientY > hoverMiddleY))) {
      return;
    }

    props.onChangeIndex(index, hoverIndex, take);

    (monitor.getItem() as any).index = hoverIndex;
    if (containerId !== props.containerId) {
      (monitor.getItem() as any).containerId = props.containerId;
      (monitor.getItem() as any).take = (list: any[]) => props.take(item, list);
    }
  },
  drop(props) {
    props.apply();
  },
};

const Draggable = DropTarget(DND_TYPE, entryTarget, collectDrop)(
    DragSource(DND_TYPE, entrySource, collectDrag)(
      DraggableItem)) as React.ComponentClass<IItemBaseProps>;

interface IBaseProps {
  id: string;
  items: ILoadOrderDisplayItem[];
  itemRenderer: React.ComponentClass<{
    className?: string,
    item: ILoadOrderDisplayItem,
    onRef: (ref: any) => any }>;
  apply: (ordered: ILoadOrderDisplayItem[]) => void;
}

interface IState {
  ordered: ILoadOrderDisplayItem[];
}

type IProps = IBaseProps & { connectDropTarget: ConnectDropTarget };

class DraggableList extends ComponentEx<IProps, IState> {
  private applyDebouncer: util.Debouncer;
  constructor(props: IProps) {
    super(props);

    this.initState({
      ordered: props.items.slice(0),
    });

    this.applyDebouncer = new util.Debouncer(() => {
      this.apply();
      return Promise.resolve() as any;
    }, 500);

  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.items !== newProps.items) {
      this.nextState.ordered = newProps.items.slice(0);
    }
  }

  public render(): JSX.Element {
    const { connectDropTarget, id, itemRenderer } = this.props;
    const { ordered } = this.state;
    return connectDropTarget((
      <div style={{ height: '100%' }}>
        <ListGroup>
          {ordered.map((item, idx) => (
            <Draggable
              containerId={id}
              key={item.id + idx.toString()}
              item={item}
              index={idx}
              itemRenderer={itemRenderer}
              take={this.take}
              onChangeIndex={this.changeIndex}
              apply={this.apply}
            />
          ))}
        </ListGroup>
      </div>
    ));
  }

  public changeIndex = (oldIndex: number, newIndex: number,
                        take: (list: ILoadOrderDisplayItem[]) => any) => {
    const { ordered } = this.state;
    if (oldIndex === undefined) {
      return;
    }

    const currentItem = ordered[oldIndex];
    const replacedItem = ordered[newIndex];

    if (!!currentItem.locked || !!replacedItem.locked) {
      return;
    }

    const condFunc = currentItem.condition || replacedItem.condition;
    const condRes: IDnDConditionResult = !!condFunc
      ? condFunc(currentItem, replacedItem)
      : undefined;
    if (!!condRes && !condRes.success) {
      currentItem.message = condRes.errMessage;
      return;
    }

    const copy = this.state.ordered.slice();
    const item = take(copy);
    copy.splice(newIndex, 0, item);

    this.nextState.ordered = copy;
    this.applyDebouncer.schedule();
  }

  private take = (item: ILoadOrderDisplayItem, list: ILoadOrderDisplayItem[]) => {
    const { ordered } = this.nextState;
    let res = item;
    const index = ordered.findIndex(entry => entry.id === item.id);
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
      (component as any).changeIndex(index, 0, take);

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

export default DropTarget(DND_TYPE, containerTarget, containerCollect)(
  DraggableList) as React.ComponentClass<IBaseProps>;
