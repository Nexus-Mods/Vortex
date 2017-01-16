import * as React from 'react';

import { IComponentContext } from '../types/IComponentContext';
import { II18NProps } from '../types/II18NProps';

import {setSafe} from './storeHelper';

export { translate } from 'react-i18next';
export { connect } from 'react-redux';
export { extend } from './ExtensionProvider';

interface IProxyEntry<T> {
  obj: T;
  path: string[];
}

export class StateProxyHandler<T> implements ProxyHandler<T> {
  private mComponent: ComponentEx<any, T>;
  private mPath: string[];
  private mBaseObject: T;
  private mSubProxies: { [key: string]: any };

  constructor(component: ComponentEx<any, T>, baseObject: T, objPath: string[]) {
    this.mComponent = component;
    this.mPath = objPath;
    this.mBaseObject = baseObject;
    this.mSubProxies = {};
  }

  public has(target: T, key: PropertyKey): boolean {
    return key in target;
  }

  public get(target: T, key: PropertyKey): any {
    return this.derive(target, key);
  }

  public set(target: T, key: PropertyKey, value: any, receiver: any): boolean {
    target[key] = value;
    const fullPath = [].concat(this.mPath, key);
    this.mBaseObject = setSafe(this.mBaseObject, fullPath, value);
    this.mComponent.setState(this.mBaseObject);
    return true;
  }

  private derive(obj: T, key: PropertyKey) {
    if (typeof(obj[key]) !== 'object') {
      return obj[key];
    }

    if (!(key in this.mSubProxies)) {
      this.mSubProxies[key] = new Proxy(obj[key],
        new StateProxyHandler(this.mComponent, this.mBaseObject, [].concat(this.mPath, key)));
    }
    return this.mSubProxies[key];
  }
}

/**
 * convenience extension for React.Component that adds support for the
 * i18n library.
 * 
 * This whole module is just here to reduce the code required for "decorated"
 * components.
 * 
 * @export
 * @class ComponentEx
 * @extends {(React.Component<P & II18NProps, S>)}
 * @template P
 * @template S
 */
export class ComponentEx<P, S> extends React.Component<P & II18NProps, S> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  public nextState: S;

  protected initState(value: S) {
    this.state = value;

    let proxyHandler = new StateProxyHandler(this, value, []);

    this.nextState = new Proxy<S>(value, proxyHandler);
  };
}
