/**
 * We currently have a circular dependency issue between ComponentEx and storeHelper.
 * This causes jest to fail when trying to automatically generate a mock for ComponentEx.
 * This mock attempts to work around that by first mocking storeHelper,
 * then trying to load the actual ComponentEx module to generate a mock from it.
 * If that still fails, it falls back to a manual mock definition.
 * 
 * The chain is: ComponentEx → storeHelper → selectors → nexus_integration → api → bbcode → LinkTag → ErrorBoundary → ComponentEx
 * 
 * NodeJS module loading at runtime can handle circular dependencies, but Jest's static analysis for mocking cannot.
 * This sucks but there's not much we can do about it without a refactor.
 */

// Mock the circular dependency first
jest.doMock('../src/util/storeHelper', () => ({
  deleteOrNop: jest.fn((obj, path) => obj),
  setSafe: jest.fn((obj, path, value) => ({ ...obj, [path[path.length - 1]]: value })),
}));

// Now try to generate the mock from the actual module
let actualModule;
try {
  actualModule = jest.requireActual('../src/util/ComponentEx');
} catch (error) {
  // If it still fails due to circular dependency, fall back to manual mock
  actualModule = null;
}

const React = require('react');

if (actualModule) {
  // If we successfully loaded the actual module, create a proper mock based on it
  const mockModule = jest.genMockFromModule('../src/util/ComponentEx');

  // Override the classes with proper React component inheritance
  class ComponentEx extends React.Component {
    static contextTypes = actualModule.ComponentEx.contextTypes || {
      api: () => null,
      menuLayer: () => null,
      getModifiers: () => null,
    };

    constructor(props) {
      super(props);
      this.nextState = this.state || {};
    }

    initState = jest.fn((value, delayed = false) => {
      this.state = JSON.parse(JSON.stringify(value));
      this.nextState = this.state;
    });

    setStatePath = jest.fn();
  }

  class PureComponentEx extends React.PureComponent {
    static contextTypes = actualModule.ComponentEx.contextTypes || {
      api: () => null,
      menuLayer: () => null,
      getModifiers: () => null,
    };

    constructor(props) {
      super(props);
      this.nextState = this.state || {};
    }

    initState = jest.fn((value, delayed = false) => {
      this.state = JSON.parse(JSON.stringify(value));
      this.nextState = this.state;
    });

    setStatePath = jest.fn();
  }

  module.exports = {
    ...mockModule,
    ComponentEx,
    PureComponentEx,
    translate: actualModule.translate || ((namespace) => (component) => component),
  };
} else {
  // Fallback to manual mock if automatic generation fails
  class ComponentEx extends React.Component {
    static contextTypes = {
      api: () => null,
      menuLayer: () => null,
      getModifiers: () => null,
    };

    constructor(props) {
      super(props);
      this.nextState = this.state || {};
    }

    initState(value, delayed = false) {
      this.state = JSON.parse(JSON.stringify(value));
      this.nextState = this.state;
    }

    setStatePath(...args) {
      return this;
    }
  }

  class PureComponentEx extends React.PureComponent {
    static contextTypes = {
      api: () => null,
      menuLayer: () => null,
      getModifiers: () => null,
    };

    constructor(props) {
      super(props);
      this.nextState = this.state || {};
    }

    initState(value, delayed = false) {
      this.state = JSON.parse(JSON.stringify(value));
      this.nextState = this.state;
    }

    setStatePath(...args) {
      return this;
    }
  }

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

  module.exports = {
    ComponentEx,
    PureComponentEx,
    translate,
    connect: require('react-redux').connect,
    extend: () => (component) => component,
  };
}
