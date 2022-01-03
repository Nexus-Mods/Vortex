import * as React from 'react';

export interface IActionOptions {
  noCollapse?: boolean;
  namespace?: string;
  hollowIcon?: boolean;
}

export type ActionFunc = (instanceId: string | string[]) => IActionDefinition[];

/**
 * interface of an action within one of the icon bars
 *
 * @export
 * @interface IActionDefinition
 */
export interface IActionDefinition {
  icon?: string;
  title?: string;
  data?: any;
  component?: React.ComponentType<any>;
  props?: () => any;
  action?: (instanceId: string | string[], data?: any) => void;
  subMenus?: IActionDefinition[] | ActionFunc;
  // condition under which the action is displayed.
  // returning false hides the action entirely. Returning a string shows
  // the action disabled and grayed out, with the returned string as a tooltip
  // so you can explain to the user why it's unavailable.
  // Please use that second option unless you're absolutely sure the user
  // will understand from context why the action is unavailable in this case.
  condition?: (instanceId: string | string[], data?: any) => boolean | string;
  position?: number;
  // if supported by the control, actions with the same group (including undefined) will be
  // displayed together, visually sligthly separated
  // position is then the order within a group but also groups are sorted by the lowest
  // priority found within that group
  group?: string;
  options?: IActionOptions;
  // in certain situations where the actions may be grouped together (e.g. in a dropdown button)
  // a default action can be triggered by the button itself.
  // The first (lowest position) action with the default flag will get triggered
  default?: boolean;
}
