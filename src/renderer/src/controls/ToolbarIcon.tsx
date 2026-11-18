import * as React from "react";

import Icon from "./Icon";
import { Button } from "./TooltipControls";

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
  /** receives the icon's <button> element */
  buttonRef?: React.Ref<HTMLButtonElement>;
}

type ButtonWithRefProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  buttonRef: React.Ref<HTMLButtonElement>;
};

// react-bootstrap 0.33's Button doesn't pass a ref on to its <button>, but it renders its
// componentClass with every prop it doesn't use itself, buttonRef among them.
function ButtonWithRef({ buttonRef, ...props }: ButtonWithRefProps) {
  return <button ref={buttonRef} {...props} />;
}

class ToolbarIcon extends React.PureComponent<IToolbarIconProps, {}> {
  public render(): JSX.Element {
    const {
      buttonRef,
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
    const refProps = buttonRef === undefined ? {} : { componentClass: ButtonWithRef, buttonRef };
    return (
      <Button
        tooltip={tooltip}
        id={id}
        placement={placement}
        onClick={this.invokeAction}
        disabled={disabled}
        className={className}
        {...(refProps as object)}
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
