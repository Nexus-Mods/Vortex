import ExtensionManager from './ExtensionManager';

import * as PropTypes from 'prop-types';
import * as React from 'react';

export interface IExtensionProps {
  extensions: ExtensionManager;
}

/**
 * provider for ui extensions. This makes extensions available to
 * to extensible components
 *
 * @export
 * @class ExtensionProvider
 * @extends {React.Component<IExtensionProps, {}>}
 */
export class ExtensionProvider extends React.Component<IExtensionProps, {}> {
  // tslint:disable-next-line:no-unused-variable
  private static childContextTypes = {
    extensions: PropTypes.object.isRequired,
  };

  public getChildContext(): any {
    const { extensions } = this.props;
    return { extensions };
  }

  public render() {
    return React.Children.only(this.props.children);
  }
}

export interface IExtensibleProps {
  group?: string;
  staticElements?: any[];
}

/**
 * extension function. This function creates a wrapper around a component that
 * binds the extensions of a component to its props
 *
 * @export
 * @param {(React.ComponentClass<P & IExtensionProps>)} ComponentToWrap the component to wrap
 * @returns {React.ComponentClass<P>} the wrapper component
 */
export function extend(registerFunc: (...args) => void, groupProp?: string) {
  const ExtensionManagerImpl: typeof ExtensionManager = require('./ExtensionManager').default;
  ExtensionManagerImpl.registerUIAPI(registerFunc.name);
  const extensions: { [group: string]: any } = {};

  const updateExtensions = (props: any, context: any) => {
    extensions[props[groupProp]] = [];
    context.extensions.apply(registerFunc.name, (...args) => {
      const res = registerFunc(props[groupProp], ...args);
      if (res !== undefined) {
        extensions[props[groupProp]].push(res);
      }
    });
  };

  return <P, S>(ComponentToWrap: React.ComponentClass<P>): any => {
    // tslint:disable-next-line:class-name
    return class __ExtendedComponent extends React.Component<IExtensibleProps & P, S> {
      public static contextTypes: React.ValidationMap<any> = {
        extensions: PropTypes.object.isRequired,
      };

      public context: IExtensionProps;
      private mObjects: any[];

      public componentWillMount(): void {
        if (extensions[this.props[groupProp]] === undefined) {
          updateExtensions(this.props, this.context);
        }
      }

      public componentWillReceiveProps(nextProps: any) {
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

        if (this.mObjects === undefined) {
          this.mObjects = [].concat(staticElements || [], extensions[this.props[groupProp]] || []);
        }

        const wrapProps: any = {
          ...(this.props as any),
          objects: this.mObjects,
        };
        delete wrapProps.staticElements;
        delete wrapProps.group;
        return React.createElement(ComponentToWrap, wrapProps, children);
      }
    };
  };
}
