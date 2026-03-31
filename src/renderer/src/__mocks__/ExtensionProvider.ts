import * as React from "react";
import { vi } from "vitest";

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

function useExtensionObjects<T>(
  _registerFunc: (...args: any[]) => any,
  _defaultValue?: any,
  _filterFunc?: any,
): T[] {
  return [];
}

const useExtensionContext = () => ({
  getApi: () => ({
    events: { on: vi.fn(), emit: vi.fn() },
    getState: vi.fn(() => ({})),
    translate: vi.fn((key: string) => key),
  }),
});

const ExtensionContext = React.createContext(null);

const ExtensionProvider: React.FC<any> = ({ children }) =>
  React.createElement(React.Fragment, null, children);

export { extend, useExtensionObjects, useExtensionContext, ExtensionContext, ExtensionProvider };
export default { extend, useExtensionObjects, useExtensionContext, ExtensionContext, ExtensionProvider };
