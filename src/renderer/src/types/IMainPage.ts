import type * as React from "react";

import type ReduxProp from "../ReduxProp";

/**
 * interface of a "main page", that is: a content page
 * displaying a lot of data and thus requiring a lot of screen
 * space
 *
 * @export
 * @interface IMainPage
 */
export interface IMainPage {
  id: string;
  icon: string;
  mdi?: string;
  title: string;
  component: React.ComponentClass<any> | React.FunctionComponent<React.PropsWithChildren<any>>;
  propsFunc: () => any;
  visible: () => boolean;
  group: "global" | "per-game" | "support" | "hidden" | "dashboard";
  isClassicOnly?: boolean;
  isModernOnly?: boolean;
  /**
   * Opt this page into the redesigned UI. When set, MainPageContainer skips the legacy
   * `.main-page` / header / body-container chrome and renders the page component as the
   * sole root (it is expected to render its own Page), keeping the DOM subtree flat.
   *
   * A page that kept its old rendering as well passes a callback instead, deciding for
   * itself which of the two it is about to draw — the mods page reads the classic/modern
   * setting. It is resolved wherever that setting is already watched, so the answer
   * follows a change to it rather than being fixed when the page registered.
   */
  newLayout?: boolean | (() => boolean);
  priority?: number;
  badge?: ReduxProp<any>;
  activity?: ReduxProp<boolean>;
  namespace?: string;
  onReset?: () => void;
  menuBadge?: React.ComponentType<React.PropsWithChildren<unknown>>;
}
