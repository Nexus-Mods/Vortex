import * as React from 'react';

function bindProps(boundProps: {[key: string]: any}) {
  return <P, S>(ComponentToWrap: React.ComponentType<P>): any => {
    // tslint:disable-next-line:class-name
    return class __BoundComponent extends React.Component<P, S> {
      public render() {
        const {children} = this.props;

        const wrapProps: any = {
          ...boundProps,
          ...(this.props as any),
        };

        return React.createElement(ComponentToWrap, wrapProps, children);
      }
    };
  };
}

export default bindProps;
