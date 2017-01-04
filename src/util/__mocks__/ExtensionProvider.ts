import * as React from 'react';

const ext = jest.genMockFromModule('../ExtensionProvider');
console.log('inside mock');
function extend(registerFunc) {
  return (component) => {
    return class __ExtendedComponent extends React.Component {
      render() {
        let wrapProps = Object.assign({}, this.props, { objects: [] });
        return React.createElement(component, wrapProps, []);
      }
    }
  };
}

module.exports = {
  extend
};
