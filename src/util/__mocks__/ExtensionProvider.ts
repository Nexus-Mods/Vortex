import * as React from 'react';

const ext = jest.genMockFromModule('../ExtensionProvider');

function extend(registerFunc) {
  return (component) => {
    // tslint:disable-next-line:class-name
    return class __ExtendedComponent extends React.Component<any, any> {
      public render() {
        const wrapProps = {
          ...this.props,
          objects: [],
        };
        return React.createElement(component, wrapProps, []);
      }
    };
  };
}

ext['extend'] = extend;

module.exports = ext;
