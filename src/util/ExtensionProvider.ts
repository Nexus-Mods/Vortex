import ExtensionManager from './ExtensionLoader';

import * as React from 'react';

interface IExtensionProps {
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
    extensions: React.PropTypes.object.isRequired,
  };

  public getChildContext(): Object {
    const { extensions } = this.props;
    return { extensions };
  }

  public render(): JSX.Element {
    return React.Children.only(this.props.children);
  }
}

interface IExtensibleProps {
  group?: string;
  staticElements: any[];
}

/**
 * extension function. This function creates a wrapper around a component that binds
 * the extensions of a component to its props
 * 
 * @export
 * @param {(React.ComponentClass<P & IExtensionProps>)} ComponentToWrap the component to wrap
 * @returns {React.ComponentClass<P>} the wrapper component
 */
export function extension(registerFunc: Function) {
  // return <P, S>(ComponentToWrap: React.ComponentClass<P>): React.ComponentClass<IExtensibleProps & P> => {
  return <P, S>(ComponentToWrap: React.ComponentClass<P>): any => {
    return class __ExtendedComponent extends React.Component<IExtensibleProps & P, S> {
      public static contextTypes: React.ValidationMap<any> = {
        extensions: React.PropTypes.object.isRequired,
      };

      public context: IExtensionProps;
      private mExtensions: any[];

      public componentWillMount(): void {
        this.mExtensions = this.props.staticElements || [];

        this.context.extensions.apply(registerFunc.name, (...args) => {
          const res = registerFunc(this, ...args);
          if (res !== undefined) {
            this.mExtensions.push(res);
          }
        });
      }

      public render(): JSX.Element {
        let wrapProps = Object.assign({}, this.props, { objects: this.mExtensions });
        delete wrapProps.staticElements;
        delete wrapProps.group;
        return React.createElement(ComponentToWrap, wrapProps, []);
      }
    };
  };
};
