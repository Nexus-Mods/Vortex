import ExtensionManager from './ExtensionManager';

import { IExtendedProps, IExtensibleProps } from '../types/IExtensionProvider';

import * as _ from 'lodash';
import * as React from 'react';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export const ExtensionContext = React.createContext({});

export interface IExtensionProps {
  extensions: ExtensionManager;
}

/**
 * extension function. This function creates a wrapper around a component that
 * binds the extensions of a component to its props
 *
 * @export
 * @param {(React.ComponentClass<P & IExtensionProps>)} ComponentToWrap the component to wrap
 * @returns {React.ComponentClass<P>} the wrapper component
 */
export function extend(registerFunc: (...args) => void, groupProp?: string, addExtInfo?: boolean):
    <P extends IExtendedProps>(component: React.ComponentType<P>) =>
      React.ComponentType<Omit<P, keyof IExtendedProps> & IExtensibleProps> {
  const ExtensionManagerImpl: typeof ExtensionManager = require('./ExtensionManager').default;
  ExtensionManagerImpl.registerUIAPI(registerFunc.name);
  const extensions: { [group: string]: any } = {};

  const updateExtensions = (props: any, context: any) => {
    extensions[props[groupProp]] = [];
    context.apply(registerFunc.name, (extInfo, ...args) => {
      const res = registerFunc(props[groupProp], extInfo, ...args);
      if (res !== undefined) {
        extensions[props[groupProp]].push(res);
      }
    }, addExtInfo);
  };

  return <P extends IExtendedProps, S>(ComponentToWrap: React.ComponentType<P>)
        : React.ComponentType<Omit<P, keyof IExtendedProps>> => {
    // tslint:disable-next-line:class-name
    type PropsT = Omit<P, keyof IExtendedProps> & IExtensibleProps;
    // tslint:disable-next-line:class-name
    return class __ExtendedComponent extends React.Component<PropsT, S> {
      public static contextType = ExtensionContext;

      private mObjects: any[];

      public UNSAFE_componentWillReceiveProps(nextProps: any) {
        if (this.props[groupProp] !== nextProps[groupProp]) {
          if (extensions[nextProps[groupProp]] === undefined) {
            updateExtensions(nextProps, this.context);
          }
        }
        if (this.props.staticElements !== nextProps.staticElements) {
          this.mObjects = undefined;
        }
      }

      public render(): JSX.Element {
        const { children, staticElements } = this.props;

        if (extensions[this.props[groupProp]] === undefined) {
          updateExtensions(this.props, this.context);
        }

        if (this.mObjects === undefined) {
          this.mObjects = [].concat(staticElements || [], extensions[this.props[groupProp]] || []);
        }

        const wrapProps: any = {
          ..._.omit(this.props, ['staticElements', 'group']),
          objects: this.mObjects,
        };
        return React.createElement(ComponentToWrap, wrapProps, children);
      }
    };
  };
}
