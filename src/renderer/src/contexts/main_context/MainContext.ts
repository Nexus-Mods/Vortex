// The context every ComponentEx reads: the extension api, the layer menus open on, and the
// current modifier keys. MainProvider (contexts/MainContext.tsx) provides it. It lives here,
// apart from MainProvider, because MainProvider's imports reach most of the app, ComponentEx's
// subclasses among them, and ComponentEx needs this at class definition.
import PropTypes from "prop-types";
import { Component, createContext, type ReactNode, type ValidationMap } from "react";

import type { IComponentContext } from "../../types/IComponentContext";

// What a component reads when no provider is above it. React gives a separate root no
// provider, and react-bootstrap 0.33's OverlayTrigger renders its overlay as one, so
// MainProvider fills this in with the app's values for anything rendered that way.
const fallback: IComponentContext = {
  api: undefined,
  menuLayer: undefined,
  getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
};

export const MainContext = createContext<IComponentContext>(fallback);

/** Makes `value` what a component with no MainContext provider above it reads. */
export function setMainContextFallback(value: Partial<IComponentContext>): void {
  Object.assign(fallback, value);
}

interface IComponentExProviderProps {
  children: ReactNode;
}

// Hands MainContext on as old-style (legacy) context, for community extensions whose classes
// declare contextTypes themselves instead of extending ComponentEx. The legacy context API is
// only available to class components.
// eslint-disable-next-line @eslint-react/no-class-component
export class ComponentExProvider extends Component<IComponentExProviderProps> {
  public static contextType = MainContext;
  declare public context: IComponentContext;

  public static childContextTypes: ValidationMap<unknown> = {
    api: PropTypes.object.isRequired,
    menuLayer: PropTypes.object,
    getModifiers: PropTypes.func,
  };

  // eslint-disable-next-line @eslint-react/no-unused-class-component-members
  public getChildContext(): IComponentContext {
    return this.context;
  }

  public render() {
    return this.props.children;
  }
}
