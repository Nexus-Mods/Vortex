import * as React from "react";
import { Button, Popover, ControlLabel, FormGroup } from "react-bootstrap";
import { ComponentEx, Icon, tooltip } from "vortex-api";

export interface IBaseActionProps {
  onSetModAttribute: (
    gameMode: string,
    modId: string,
    attributeId: string,
    value: any,
  ) => void;
}

export interface IBaseConnectedProps {
  gameMode: string;
}

export interface IPopoverProps {
  toggleColors: (evt: any) => void;
  toggleIcons: (evt: any) => void;
}

export class HighlightBase<P, S extends object> extends ComponentEx<P, S> {
  protected mRef: any;
  protected renderHighlightColor(
    highlightColor: string,
    onClick: (evt: any) => void,
  ): JSX.Element {
    return (
      <Button
        type="button"
        key={highlightColor}
        className={"highlight-base " + highlightColor}
        id={highlightColor}
        value={highlightColor}
        onClick={onClick}
      >
        <Icon
          name={highlightColor === "highlight-default" ? "remove" : "add"}
        />
      </Button>
    );
  }

  protected renderPopover(popProps: IPopoverProps): JSX.Element {
    const { t } = this.props;
    const { toggleColors, toggleIcons } = popProps;
    return (
      <Popover id="popover-highlight-settings" title={t("Highlight Settings")}>
        <FormGroup key={"some-form"}>
          <ControlLabel>{t("Select theme")}</ControlLabel>
          <div key="dialog-form-colors">
            {cssHighlightList.map((highlightColor) => {
              return this.renderHighlightColor(highlightColor, toggleColors);
            })}
          </div>
          <ControlLabel>{t("Select mod icon")}</ControlLabel>
          <div className="highlight-icons">
            {modIcons.map((icon) => this.renderIcons(icon, toggleIcons))}
          </div>
        </FormGroup>
      </Popover>
    );
  }

  protected renderIcons(
    icon: string,
    onClick: (evt: any) => void,
  ): JSX.Element {
    return (
      <Button
        type="button"
        key={icon}
        className="btn-embed"
        id={icon}
        value={icon}
        onClick={onClick}
      >
        <Icon name={icon} />
      </Button>
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

export const modIcons: string[] = [
  "highlight-conflict",
  "highlight-patch",
  "highlight-shield",
  "highlight-map",
  "highlight-lab",
  "highlight-flag",
  "highlight-temple",
  "highlight-home",
  "highlight-person",
  "highlight-visuals",
  "highlight-tool",
  "highlight-ui",
  "highlight",
];

export const cssHighlightList: string[] = [
  "highlight-1",
  "highlight-2",
  "highlight-3",
  "highlight-4",
  "highlight-5",
  "highlight-6",
  "highlight-7",
  "highlight-8",
  "highlight-default",
];
