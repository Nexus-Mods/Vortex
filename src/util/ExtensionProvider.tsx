import { IExtensionProps } from '../types/Extension';
import * as React from 'react';

export class ExtensionProvider extends React.Component<IExtensionProps, {}> {
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

export function extension<P, S>(ComponentToWrap: React.ComponentClass<P & IExtensionProps>)
: React.ComponentClass<P> {
  return class ExtendedComponent<P, S> extends React.Component<P, S> {
    public static contextTypes: React.ValidationMap<any> = {
      extensions: React.PropTypes.array.isRequired,
    };

    public context: IExtensionProps;

    public render(): JSX.Element {
      const { extensions } = this.context;
      return (
        <ComponentToWrap {...this.props} extensions={extensions} />
      );
    }
  };
};
