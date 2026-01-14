import type { IExtensibleProps } from "../../types/IExtensionProvider";
import type { IActionControlProps } from "./ActionControl";
import ActionControl from "./ActionControl";
import type { IContextMenuProps } from "./ContextMenu";
import ContextMenu from "./ContextMenu";

import * as _ from "lodash";
import * as React from "react";

export type ExportType = IContextMenuProps &
  IActionControlProps &
  IExtensibleProps &
  React.HTMLAttributes<any>;

class ActionContextMenu extends React.Component<ExportType> {
  private static ACTION_PROPS = [
    "filter",
    "group",
    "instanceId",
    "staticElements",
  ];
  public render() {
    const actionProps: IActionControlProps = _.pick(
      this.props,
      ActionContextMenu.ACTION_PROPS,
    ) as IActionControlProps;
    const menuProps: IContextMenuProps = _.omit(
      this.props,
      ActionContextMenu.ACTION_PROPS,
    ) as any;
    return (
      <ActionControl {...actionProps}>
        <ContextMenu {...menuProps} />
      </ActionControl>
    );
  }
}

export default ActionContextMenu;
