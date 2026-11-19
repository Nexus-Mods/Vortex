import * as React from "react";

import Icon from "../Icon";
import { Button } from "../TooltipControls";
import { withDomRef } from "../with_dom_ref/withDomRef";

export interface IToolbarIconProps {
  id?: string;
  instanceId?: string[];
  text?: string;
  placement?: "top" | "right" | "bottom" | "left";
  iconSet?: string;
  icon?: string;
  tooltip?: string;
  onClick?: (ids: string[]) => void;
  pulse?: boolean;
  spin?: boolean;
  disabled?: boolean;
  className?: string;
  stroke?: boolean;
  hollow?: boolean;
  children?: React.ReactNode;
  /**
   * receives the icon's <button> element. react-bootstrap's Button doesn't pass a ref on, so
   * the <button> comes back through this instead.
   */
  domRef?: React.Ref<HTMLButtonElement>;
}

const ButtonWithDomRef = withDomRef("button");

class ToolbarIcon extends React.PureComponent<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const {
      domRef,
      className,
      id,
      text,
      tooltip,
      icon,
      iconSet,
      pulse,
      spin,
      stroke,
      hollow,
      disabled,
    } = this.props;
    const placement = this.props.placement || "bottom";
    const refProps = { componentClass: ButtonWithDomRef, domRef };
    return (
      <Button
        tooltip={tooltip}
        id={id}
        placement={placement}
        onClick={this.invokeAction}
        disabled={disabled}
        className={className}
        {...refProps}
      >
        {icon !== undefined ? (
          <Icon
            set={iconSet}
            name={icon}
            pulse={pulse}
            spin={spin}
            stroke={stroke}
            hollow={hollow}
          />
        ) : null}
        {text !== undefined ? <div className="button-text">{text}</div> : null}
        {this.props.children}
      </Button>
    );
  }

  private invokeAction = (evt: React.MouseEvent<Button>) => {
    const { instanceId, onClick } = this.props;
    if (onClick !== undefined) {
      evt.preventDefault();
      onClick(instanceId);
    }
  };
}

export default ToolbarIcon;
