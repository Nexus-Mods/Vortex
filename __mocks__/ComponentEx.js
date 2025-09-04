const React = require('react');

// Mock translate function
function translate(namespace) {
  return (component) => {
    return class Translation extends React.Component {
      render() {
        return React.createElement(component, Object.assign({}, this.props, {
          t: (str) => str
        }), []);
      }
    }
  } 
}

// Mock other ComponentEx exports
const ComponentEx = jest.genMockFromModule('../src/util/ComponentEx');

module.exports = {
  ...ComponentEx,
  translate,
  connect: require('react-redux').connect,
  extend: () => (component) => component,
};
