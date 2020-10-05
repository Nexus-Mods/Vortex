import * as React from 'react';

export interface IActionOptions {
  noCollapse?: boolean;
  namespace?: string;
}

/**
 * interface of an action within one of the icon bars
 *
 * @export
 * @interface IActionDefinition
 */
export interface IActionDefinition {
  icon?: string;
  title?: string;
  component?: React.ComponentClass<any> | React.StatelessComponent<any>;
  props?: () => any;
  action?: (instanceId: string | string[]) => void;
  // condition under which the action is displayed.
  // returning false hides the action entirely. Returning a string shows
  // the action disabled and grayed out, with the returned string as a tooltip
  // so you can explain to the user why it's unavailable.
  // Please use that second option unless you're absolutely sure the user
  // will understand from context why the action is unavailable in this case.
  condition?: (instanceId: string | string[]) => boolean | string;
  position?: number;
  options?: IActionOptions;
  // in certain situations where the actions may be grouped together (e.g. in a dropdown button)
  // a default action can be triggered by the button itself.
  // The first (lowest position) action with the default flag will get triggered
  default?: boolean;
}
