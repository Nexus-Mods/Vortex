import { ComponentEx } from "@nexusmods/vortex-api";
import * as React from "react";
import { Popover } from "react-bootstrap";

import HighlightPicker from "../views/HighlightPicker";

export interface IBaseActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
}

export interface IBaseConnectedProps {
  gameMode: string;
}

export interface IPopoverProps {
  toggleColors: (color: string) => void;
  toggleIcons: (icon: string) => void;
}

export class HighlightBase<P, S extends object> extends ComponentEx<P, S> {
  protected mRef: any;

  protected renderPopover(popProps: IPopoverProps): JSX.Element {
    const { t } = this.props;
    const { toggleColors, toggleIcons } = popProps;
    return (
      <Popover id="popover-highlight-settings" title={t("Highlight Settings")}>
        <HighlightPicker onSelectColor={toggleColors} onSelectIcon={toggleIcons} />
      </Popover>
    );
  }

  protected setRef = (ref: any) => {
    this.mRef = ref;
  };

  protected get bounds(): DOMRect {
    return {
      top: 0,
      left: 0,
      bottom: window.innerHeight,
      right: window.innerWidth,
      height: window.innerHeight,
      width: window.innerWidth,
    } as any;
  }
}
