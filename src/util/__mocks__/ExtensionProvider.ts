import * as React from 'react';

import * as jest from 'jest';

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
