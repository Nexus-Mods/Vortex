/* eslint-disable */
import { selectors, types } from 'vortex-api';

import { GAME_ID } from './common';
import { getPersistentLoadOrder } from './migrations';

export type PriorityType = 'position-based' | 'prefix-based';

export interface IOffsetMap {
  [offset: number]: number;
}

interface IProps {
  state: types.IState;
  profile: types.IProfile;
  loadOrder: types.LoadOrder;
  minPriority: number;
}

export class PriorityManager {
  private mApi: types.IExtensionApi;
  private mPriorityType: PriorityType;
  private mMaxPriority: number;

  constructor(api: types.IExtensionApi, priorityType: PriorityType) {
    this.mApi = api;
    this.mPriorityType = priorityType;
    this.resetMaxPriority();
  }

  set priorityType(type: PriorityType) {
    this.mPriorityType = type;
  }

  get priorityType() {
    return this.mPriorityType;
  }

  public resetMaxPriority = (min?: number) => {
    const props: IProps = this.genProps(min);
    if (props === undefined) {
      this.mMaxPriority = 0;
      return;
    }
    this.mMaxPriority = this.getMaxPriority(props);
  }

  public getPriority = (loadOrder: types.LoadOrder, item: types.ILoadOrderEntry) => {
    if (item === undefined) {
      // Send it off to the end.
      return ++this.mMaxPriority;
    }
    const minPriority = Object.keys(loadOrder).filter(key => loadOrder[key]?.locked).length + 1;

    const itemIdx = loadOrder.findIndex(x => x?.id === item.id);
    if (itemIdx !== -1) {
      if (this.mPriorityType === 'position-based') {
        const position = itemIdx + 1;
        return (position > minPriority)
          ? position : ++this.mMaxPriority;
      } else {
        const prefixVal = loadOrder[itemIdx]?.data?.prefix ?? loadOrder[itemIdx]?.['prefix'];
        const intVal = prefixVal !== undefined
          ? parseInt(prefixVal, 10)
          : itemIdx;
        const posVal = itemIdx;
        if (posVal !== intVal && intVal > minPriority) {
          return intVal;
        } else {
          return (posVal > minPriority)
            ? posVal : ++this.mMaxPriority;
        }
      }
    }

    return ++this.mMaxPriority;
  }

  private genProps = (min?: number): IProps => {
    const state: types.IState = this.mApi.getState();
    const lastProfId = selectors.lastActiveProfileForGame(state, GAME_ID);
    if (lastProfId === undefined) {
      return undefined;
    }
    const profile = selectors.profileById(state, lastProfId);
    if (profile === undefined) {
      return undefined;
    }

    const loadOrder: types.LoadOrder = getPersistentLoadOrder(this.mApi);

    const lockedEntries = Object.keys(loadOrder).filter(key => loadOrder[key]?.locked);
    const minPriority = (min) ? min : lockedEntries.length;
    return { state, profile, loadOrder, minPriority };
  }

  public getMaxPriority = (props: IProps) => {
    const { loadOrder, minPriority } = props;
    return Object.keys(loadOrder).reduce((prev, key) => {
      const prefixVal = loadOrder[key]?.data?.prefix ?? loadOrder[key]?.prefix;
      const intVal = prefixVal !== undefined
        ? parseInt(loadOrder[key].prefix, 10)
        : loadOrder[key].pos;
      const posVal = loadOrder[key].pos;
      if (posVal !== intVal) {
        prev = (intVal > prev)
          ? intVal : prev;
      } else {
        prev = (posVal > prev)
          ? posVal : prev;
      }
      return prev;
    }, minPriority);
  }
}
