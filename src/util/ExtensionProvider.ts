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

  public render(): JSX.Element {
    return React.Children.only(this.props.children);
  }
}

export interface IExtensibleProps {
  group?: string;
  staticElements: any[];
}

/**
 * extension function. This function creates a wrapper around a component that
 * binds the extensions of a component to its props
 *
 * @export
 * @param {(React.ComponentClass<P & IExtensionProps>)} ComponentToWrap the component to wrap
 * @returns {React.ComponentClass<P>} the wrapper component
 */
export function extend(registerFunc: (...args) => void) {
  const ExtensionManagerImpl: typeof ExtensionManager = require('./ExtensionManager').default;
  ExtensionManagerImpl.registerUIAPI(registerFunc.name);

  return <P, S>(ComponentToWrap: React.ComponentClass<P>): any => {
    // tslint:disable-next-line:class-name
    return class __ExtendedComponent extends React.Component<IExtensibleProps & P, S> {
      public static contextTypes: React.ValidationMap<any> = {
        extensions: PropTypes.object.isRequired,
      };

      public context: IExtensionProps;
      private mExtensions: any[];
      private mObjects: any[];

      public componentWillMount(): void {
        this.mExtensions = [];
        this.context.extensions.apply(registerFunc.name, (...args) => {
          const res = registerFunc(this.props, ...args);
          if (res !== undefined) {
            this.mExtensions.push(res);
          }
        });
      }

      public componentWillReceiveProps(nextProps: any) {
        if (this.props.group !== nextProps.group) {
          this.mExtensions = [];
          this.mObjects = undefined;
          this.context.extensions.apply(registerFunc.name, (...args) => {
            const res = registerFunc(nextProps, ...args);
            if (res !== undefined) {
              this.mExtensions.push(res);
            }
          });
        }
        if (this.props.staticElements !== nextProps.staticElements) {
          this.mObjects = undefined;
        }
      }

      public render(): JSX.Element {
        const { children, staticElements } = this.props;

        if (this.mObjects === undefined) {
          this.mObjects = [].concat(staticElements || [], this.mExtensions || []);
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
