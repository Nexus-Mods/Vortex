/* eslint-disable */
import * as React from 'react';
import { ListGroup } from 'react-bootstrap';
import {
  ConnectDropTarget, DropTarget, DropTargetConnector, DropTargetMonitor,
  DropTargetSpec
} from 'react-dnd';
import { ComponentEx } from '../util/ComponentEx';
import DraggableItem from './DraggableListItem';

export interface IDraggableListProps {
  disabled?: boolean;
  id: string;
  itemTypeId: string;
  items: any[];
  isLocked?: (item: any) => boolean;
  idFunc?: (item: any) => string;
  itemRenderer: React.ComponentType<{ item: any }>;
  apply: (ordered: any[]) => void;
  style?: React.CSSProperties;
  className?: string;
}

interface IDraggableListState {
  ordered: any[];
  selectedItems: any[];  // Track selected items
  lastSelectedIndex: number | null;  // Track the last clicked index for shift selection
  draggedItems: any[];  // Track dragged items
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

  constructor(props: IProps) {
    super(props);

    this.initState({
      ordered: props.items.slice(0),
      selectedItems: [],
      lastSelectedIndex: null,
      draggedItems: [],
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.items !== newProps.items) {
      this.nextState.ordered = newProps.items.slice(0);
    }
  }

  public render(): JSX.Element {
    const { connectDropTarget, id, itemRenderer, style, className } = this.props;
    const { ordered, selectedItems, draggedItems } = this.state;
    const isSelected = (item) => selectedItems.some(it => this.itemId(item) === this.itemId(it));

    return connectDropTarget(
      <div style={style} className={className}>
        <ListGroup>
          {ordered.map((item, idx) => (
            <DraggableItem
              disabled={this.props.disabled}
              containerId={id}
              key={this.itemId(item)}
              item={item}
              index={idx}
              findItemIndex={this.findItemIndex}
              isLocked={this.itemLocked(item)}
              itemRenderer={itemRenderer}
              take={this.take}
              onChangeIndex={this.changeIndex}
              apply={this.apply}
              onClick={this.handleItemClick(idx)}
              selectedItems={selectedItems}
              isSelected={isSelected(item)}
              draggedItems={draggedItems}
              onDragStart={this.handleDragStart}
            />
          ))}
        </ListGroup>
      </div>
    );
  }

  private handleItemClick = (index: number) => (event: React.MouseEvent) => {
    const { ordered, selectedItems, lastSelectedIndex } = this.state;
    const item = ordered[index];
    if (this.itemLocked(item) || this.props.disabled) {
      this.nextState.draggedItems = [];
      this.nextState.selectedItems = [];
      this.nextState.lastSelectedIndex = null;
      return;
    }
    let newSelectedItems = selectedItems.slice();
    this.nextState.draggedItems = [];

    if (event.ctrlKey) {
      // Handle Ctrl for multi-selection
      if (selectedItems.includes(item)) {
        newSelectedItems = selectedItems.filter(i => i !== item);  // Deselect
      } else {
        newSelectedItems.push(item);  // Select
      }
    } else if (event.shiftKey && lastSelectedIndex !== null) {
      // Handle Shift for range selection
      const range = [lastSelectedIndex, index].sort((a, b) => a - b);
      const rangeItems = ordered.slice(range[0], range[1] + 1);
      newSelectedItems = [...new Set([...selectedItems, ...rangeItems])];
    } else {
      // Regular click selects single item and deselects others
      newSelectedItems = [item];
    }

    this.nextState.selectedItems = newSelectedItems;
    this.nextState.lastSelectedIndex = index;  // Update last selected index for shift selection
  };

  public changeIndex = (oldIndex: number, newIndex: number, changeContainer: boolean, take: (list: any[]) => any) => {
    const { selectedItems, ordered } = this.state;
    const copy = ordered.slice();

    // If multiple items are selected, handle reordering for all of them
    let itemsToMove = selectedItems.includes(copy[oldIndex])
      ? selectedItems
      : [take(changeContainer ? undefined : copy)];  // Fall back to single item

    // Remove selected items from their old position
    itemsToMove.forEach(item => {
      const index = copy.indexOf(item);
      if (index !== -1) {
        copy.splice(index, 1);
      }
    });

    // Insert items in new position
    itemsToMove.forEach(itm => {
      const item = Array.isArray(itm) ? itm[0] : itm;
      copy.splice(newIndex, 0, item);
      newIndex++;
    });

    this.nextState.ordered = copy;
  }

  private itemLocked(item: any) {
    const itm = Array.isArray(item) ? item[0] : item;
    return this.props.isLocked?.(itm) ?? false;
  }

  private itemId(item: any) {
    const itm = Array.isArray(item) ? item[0] : item;
    if (this.props.idFunc !== undefined) {
      return this.props.idFunc(itm);
    } else if (itm.id !== undefined) {
      return itm.id;
    } else {
      return itm;
    }
  }

  private findItemIndex = (item: any) => {
    return this.nextState.ordered.findIndex(iter => this.itemId(iter) === this.itemId(item));
  }

  private take = (item: any, list: any[]) => {
    const { ordered } = this.nextState;
    let res = item;
    const index = this.findItemIndex(item);
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
    const orderSet = new Set<string>();
    this.props.apply(this.state.ordered.slice().reduce((acc, item) => {
      if (!orderSet.has(this.itemId(item))) {
        orderSet.add(this.itemId(item));
        acc.push(item);
      }
      return acc;
    }, []));
    this.nextState.selectedItems = [];
    this.nextState.draggedItems = [];
    this.nextState.lastSelectedIndex = null;
  }

  private handleDragStart = (items: any[]) => {
    this.nextState.draggedItems = items.sort((a, b) => this.findItemIndex(a) - this.findItemIndex(b));
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

function containerCollect(connect: DropTargetConnector, monitor: DropTargetMonitor) {
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