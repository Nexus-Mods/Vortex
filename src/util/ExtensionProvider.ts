import { IExtensionContext, IExtensionInit, IExtensionProps } from '../types/Extension';

import * as React from 'react';

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
    extensions: React.PropTypes.array.isRequired,
  };

  public getChildContext(): Object {
    const { extensions } = this.props;
    return { extensions };
  }

  public render(): JSX.Element {
    return React.Children.only(this.props.children);
  }
}

function emptyExtensionContext(): IExtensionContext {
  return {
    registerSettings: (title: string, component: React.ComponentClass<any>) => undefined,
    registerIcon: (group: string, icon: string, title: string, action: any) => undefined,
    registerReducer: (path: string[], reducer: any) => undefined,
    once: (): void => undefined,
  };
}

interface IExtensibleProps {
  group?: string;
  staticElements: any[];
}

/**
 * retrieve list of all reducers registered by extensions
 */
export function getReducers(extensions: IExtensionInit[]) {
  let reducers = [];

  let context = emptyExtensionContext();

  context.registerReducer = (path: string[], reducer: any) => {
    reducers.push({ path, reducer });
  };

  extensions.forEach((ext) => ext(context));

  return reducers;
}

/**
 * call the "once" function for all extensions. This should really only be called
 * once.
 */
export function doOnce(extension: IExtensionInit[]) {
  let context = emptyExtensionContext();

  context.once = (callback: () => void) => {
    callback();
  };

  extension.forEach((ext) => ext(context));
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
        extensions: React.PropTypes.array.isRequired,
      };

      public context: IExtensionProps;

      private mExtensions: any[];

      public componentWillMount(): void {
        this.mExtensions = this.props.staticElements || [];

        let extContext = emptyExtensionContext();
        extContext[registerFunc.name] = (...args) => {
          const res = registerFunc(this, ...args);
          if (res !== undefined) {
            this.mExtensions.push(res);
          }
        };

        this.context.extensions.forEach((ext) => ext(extContext));
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
