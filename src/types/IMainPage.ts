import type ReduxProp from "../renderer/ReduxProp";

import type * as React from "react";

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
  title: string;
  component: React.ComponentClass<any> | React.StatelessComponent<any>;
  propsFunc: () => any;
  visible: () => boolean;
  group: "global" | "per-game" | "support" | "hidden" | "dashboard";
  isClassicOnly?: boolean;
  isModernOnly?: boolean;
  priority?: number;
  badge?: ReduxProp<any>;
  activity?: ReduxProp<boolean>;
  namespace?: string;
  onReset?: () => void;
}
