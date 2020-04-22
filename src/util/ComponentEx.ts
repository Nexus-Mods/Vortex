import * as React from 'react';

import { IComponentContext } from '../types/IComponentContext';

import { deleteOrNop, setSafe } from './storeHelper';

import * as PropTypes from 'prop-types';
import { WithTranslation, withTranslation } from 'react-i18next';
export { connect } from 'react-redux';
export { extend } from './ExtensionProvider';

const translate: any = withTranslation;

// react-i18next typings are borked atm, forcing the props of the wrapped class
// to declare all parameter it injects as non-optional, meaning you're not allowed
// to have a class that can also work without (some of) them.
export {
  translate,
};

export class StateProxyHandler<T extends object> implements ProxyHandler<T> {
  private mComponent: ComponentEx<any, T> | PureComponentEx<any, T>;
  private mPath: string[];
  private mBaseObject: T;
  private mParent: StateProxyHandler<T>;
  private mSubProxies: { [key: string]: {
    proxy: any,
    obj: any,
  } };
  private mDelayed: boolean;
  private mDelayedTimer: NodeJS.Immediate;

  constructor(component: ComponentEx<any, T> | PureComponentEx<any, T>,
              baseObject: T, parent: StateProxyHandler<T>, objPath: string[],
              delayed: boolean) {
    this.mComponent = component;
    this.mPath = objPath;
    this.mBaseObject = baseObject;
    this.mParent = parent;
    this.mSubProxies = {};
    this.mDelayed = delayed;
  }

  public has(target: T, key: PropertyKey): boolean {
    return key in target;
  }

  public get(target: T, key: PropertyKey): any {
    return this.derive(target, key);
  }

  public deleteProperty(target: T, key: PropertyKey): boolean {
    delete target[key];
    const fullPath = [].concat(this.mPath, key);
    this.setBaseObject(deleteOrNop(this.baseObject(), fullPath));
    this.mComponent.setState(this.baseObject());
    return true;
  }

  public set(target: T, key: PropertyKey, value: any, receiver: any): boolean {
    target[key] = value;
    const fullPath = [].concat(this.mPath, key);
    this.setBaseObject(setSafe(this.baseObject(), fullPath, value));
    return true;
  }

  private baseObject(): T {
    if (this.mParent === undefined) {
      return this.mBaseObject;
    } else {
      return this.mParent.baseObject();
    }
  }

  private setBaseObject(newObj: T) {
    if (this.mParent === undefined) {
      this.mBaseObject = newObj;
      if (this.mDelayed) {
        if (this.mDelayedTimer !== undefined) {
          clearImmediate(this.mDelayedTimer);
        }
        this.mDelayedTimer = setImmediate(() => {
          this.mComponent.setState(this.mBaseObject);
          this.mDelayedTimer = undefined;
        });
      } else {
        this.mComponent.setState(this.mBaseObject);
      }
    } else {
      this.mParent.setBaseObject(newObj);
    }
  }

  private derive(obj: T, key: PropertyKey) {
    if ((typeof(obj[key]) !== 'object') || (typeof key !== 'string')) {
      return obj[key];
    }

    if (!(key in this.mSubProxies) || (obj[key] !== this.mSubProxies[key].obj)) {
      this.mSubProxies[key] = {
        proxy: new Proxy(obj[key],
          new StateProxyHandler(this.mComponent, null, this,
                                [].concat(this.mPath, key), this.mDelayed)),
        obj: obj[key],
      };
    }
    return this.mSubProxies[key].proxy;
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
export class ComponentEx<P, S extends object>
    extends React.Component<P & Partial<WithTranslation>, S> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  public context: IComponentContext;

  public nextState: S;

  protected initState(value: S, delayed: boolean = false) {
    this.state = JSON.parse(JSON.stringify(value));

    const proxyHandler = new StateProxyHandler(this, value, undefined, [], delayed);

    this.nextState = new Proxy<S>(value, proxyHandler);
  }
}

export class PureComponentEx<P, S extends object>
    extends React.PureComponent<P & Partial<WithTranslation>, S> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  public context: IComponentContext;

  public nextState: S;

  protected initState(value: S, delayed: boolean = false) {
    this.state = JSON.parse(JSON.stringify(value));

    const proxyHandler = new StateProxyHandler(this, value, undefined, [], delayed);

    this.nextState = new Proxy<S>(value, proxyHandler);
  }
}
