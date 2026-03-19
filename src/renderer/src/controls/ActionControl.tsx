import { getErrorMessageOrDefault } from "@vortex/shared";
import type {
  ActionFunc,
  IActionDefinition,
  IActionOptions,
} from "../types/IActionDefinition";
import type { IRegisteredExtension } from "../types/extensions";
import { extend } from "../ExtensionProvider";

import * as _ from "lodash";
import * as React from "react";

export interface IActionControlProps {
  instanceId?: string | string[];
  filter?: (action: IActionDefinition) => boolean;
  showAll?: boolean;
}

export interface IExtensionProps {
  objects: IActionDefinition[];
}

type IProps = IActionControlProps & IExtensionProps;

function numOr(input: number, def: number): number {
  if (input !== undefined) {
    return input;
  } else {
    return 100;
  }
}

function iconSort(lhs: IActionDefinition, rhs: IActionDefinition): number {
  return numOr(lhs.position, 100) - numOr(rhs.position, 100);
}

export interface IActionDefinitionEx extends IActionDefinition {
  show: boolean | string;
  subMenus?: IActionDefinitionEx[] | (() => IActionDefinitionEx[]);
}

/**
 * wrapper control providing an extensible set of icons/buttons/actions
 * In the simplest form this is simply a bunch of buttons that will run
 * an action if clicked, but an icon can also be more dynamic (i.e. rendering
 * dynamic content or having multiple states)
 *
 * @class IconBar
 */
class ActionControl extends React.Component<
  IProps,
  { actions: IActionDefinitionEx[] }
> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      actions: this.actionsToShow(props),
    };
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    // TODO: since we can't know how the condition callback is implemented,
    //   there is no way to determine, based on props, whether the actions
    //   to be shown need to be updated.
    //   this here is inefficient and could technically still miss updates
    const newActions = this.actionsToShow(newProps);
    if (!_.isEqual(newActions, this.state.actions)) {
      this.setState({ actions: newActions });
    }
  }

  public render() {
    const { children, instanceId } = this.props;
    const child = React.Children.only(children);
    if (React.isValidElement(child)) {
      return React.cloneElement(child, {
        instanceId,
        actions: this.state.actions,
      } as any);
    }
  }

  private actionsToShow(props: IProps): IActionDefinitionEx[] {
    const { filter, instanceId, objects, showAll } = props;
    const instanceIds =
      typeof instanceId === "string" ? [instanceId] : instanceId;
    const checkCondition = (def: IActionDefinition): boolean | string => {
      if (def.condition === undefined) {
        return true;
      }
      try {
        return def.condition(instanceIds);
      } catch (err) {
        return `Error: ${getErrorMessageOrDefault(err)}`;
      }
    };

    const transformActions = (
      items: IActionDefinition[] | ActionFunc,
    ): IActionDefinitionEx[] => {
      if (!Array.isArray(items)) {
        items = items(instanceId);
      }
      return items
        .map(convert)
        .filter((iter) => showAll || iter.show !== false)
        .filter((iter) => filter === undefined || filter(iter))
        .sort(iconSort);
    };

    const convert = (input: IActionDefinition): IActionDefinitionEx => ({
      ...input,
      show: checkCondition(input),
      subMenus:
        input.subMenus === undefined
          ? undefined
          : () => transformActions(input.subMenus),
    });

    return transformActions(objects);
  }
}

/**
 * called to register an extension icon. Please note that this function is called once for every
 * icon bar in the ui for each icon. Only the bar with matching group name should accept the icon
 * by returning a descriptor object.
 *
 * @param {IconBar} instance the bar to test against. Please note that this is not actually an
 *                           IconBar instance but the Wrapper, as the bar itself is not yet
 *                           registered, but all props are there
 * @param {string} group name of the icon group this icon wants to be registered with
 * @param {string} icon name of the icon to use
 * @param {string} title title of the icon
 * @param {*} action the action to call on click
 * @returns
 */
function registerAction(
  instanceGroup: string,
  extInfo: Partial<IRegisteredExtension>,
  group: string,
  position: number,
  iconOrComponent: string | React.ComponentClass<any>,
  optionsIn: IActionOptions,
  titleOrProps?: string | (() => any),
  actionOrCondition?: (instanceIds?: string[]) => void | boolean,
  condition?: () => boolean | string,
): any {
  if (instanceGroup === group) {
    const options = { ...optionsIn, namespace: extInfo.namespace };
    if (typeof iconOrComponent === "string") {
      return {
        type: "simple",
        icon: iconOrComponent,
        title: titleOrProps,
        position,
        action: actionOrCondition,
        options,
        condition,
      };
    } else {
      return {
        type: "ext",
        component: iconOrComponent,
        props: titleOrProps,
        position,
        condition: actionOrCondition,
        options,
      };
    }
  } else {
    return undefined;
  }
}

export default extend(
  registerAction,
  "group",
  true,
)(ActionControl) as React.ComponentClass<IActionControlProps>;
