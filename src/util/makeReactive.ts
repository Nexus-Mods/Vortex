import {setSafe} from './storeHelper';

export class ObserverProxyHandler<T extends object> implements ProxyHandler<T> {
  private mSubscribers: Array<React.Component<any, any>> = [];

  public has(target: T, key: PropertyKey): boolean {
    return (key in target) ||
      ((typeof(key) === 'string') && (['attach', 'detach'].indexOf(key) !== -1));
  }

  public get(target: T, key: PropertyKey): any {
    if (key === 'attach') {
      return this.attach;
    } else if (key === 'detach') {
      return this.detach;
    }
    return target[key];
  }

  public set(target: T, key: PropertyKey, value: any, receiver: any): boolean {
    target[key] = value;
    this.mSubscribers.forEach(comp => {
      comp.setState({});
    });
    return true;
  }

  private attach = (component: React.Component<any, any>) => {
    this.mSubscribers.push(component);
  }

  private detach = (component: React.Component<any, any>) => {
    const index = this.mSubscribers.indexOf(component);
    if (index !== -1) {
      this.mSubscribers.splice(index, 1);
    }
  }
}

/**
 * create a proxy around the specified object that forces any
 * react component that has this proxy as a prop to update whenever
 * the object is changed (mutated)
 *
 * TODO: The implementation isn't particularly efficient (see comment in
 *   ExtensionGate.tsx), I hope we can fix that someday without changing
 *   the api
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function makeReactive<T extends object>(value: T): T {
  return new Proxy<T>(value, new ObserverProxyHandler());
}

export default makeReactive;
