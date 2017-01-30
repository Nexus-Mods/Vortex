import * as React from 'react';

const ext = jest.genMockFromModule('../ExtensionProvider');

function extend(registerFunc) {
  return (component) => {
    return class __ExtendedComponent extends React.Component<any, any> {
      public render() {
        let wrapProps = Object.assign({}, this.props, { objects: [] });
        return React.createElement(component, wrapProps, []);
      }
    };
  };
}

ext.extend = extend;

module.exports = ext;
