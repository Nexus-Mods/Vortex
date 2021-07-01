/// This implements a react hook (and wrapper) component that ensure of the components using it,
/// only one is visible at the same time.
/// It's currently intended to prevent multiple modals from showing up at once

import * as React from 'react';
import { generate as shortid } from 'shortid';

export interface IMutexContextValue {
  current: string;
  add: (newItem: string) => void;
  remove: (item: string) => void;
}

class MutexContextValue implements IMutexContextValue {
  private mQueue: string[] = [];

  public get current(): string {
    return this.mQueue.length > 0 ? this.mQueue[0] : null;
  }

  public add(newItem: string): void {
    const idx = this.mQueue.indexOf(newItem);
    if (idx === -1) {
      this.mQueue.unshift(newItem);
    }
  }

  public remove(item: string): void {
    const idx = this.mQueue.indexOf(item);
    if (idx !== -1) {
      this.mQueue.splice(idx, 1);
    }
  }
}

const MutexContext = React.createContext<IMutexContextValue>(null);

export function createQueue() {
  return new MutexContextValue();
}

export const MutexProvider = MutexContext.Provider;
export const MutexConsumer = MutexContext.Consumer;

export function useMutex(show: boolean) {
  const ctx = React.useContext(MutexContext);
  const mutexId = useRandomId();
  const [, updateState] = React.useState<object>();
  const forceUpdate = React.useCallback(() => updateState({}), []);

  React.useEffect(() => {
    if (ctx === undefined) {
      return;
    }
    if (show) {
      ctx.add(mutexId);
      forceUpdate();
    }

    return () => {
      ctx.remove(mutexId);
      forceUpdate();
    };
  }, [show]);

  return (ctx.current === mutexId) && (mutexId !== null);
}

export function useRandomId() {
  const ref = React.useRef<string>();

  if (ref.current === undefined) {
    ref.current = shortid();
  }

  return ref.current;
}

export function MutexWrapper(props: { show: boolean, children: React.ReactNode }): JSX.Element {
  const primary = useMutex(props.show);

  return primary ? React.createElement('div', undefined, props.children) : null;
}
