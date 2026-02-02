import { setDisplayBatchHighlight } from "../actions/session";
import {
  HighlightBase,
  IBaseActionProps,
  IBaseConnectedProps,
} from "../types/types";

import * as React from "react";
import { Overlay } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { ThunkDispatch } from "redux-thunk";
import { actions, selectors, ToolbarIcon, types, util } from "vortex-api";

interface IActionProps extends IBaseActionProps {
  onSetModAttributes: (
    gameMode: string,
    modIds: string[],
    attributeId: string,
    value: any,
  ) => void;
  onToggleBatchHiglighter: (enabled: boolean) => void;
}

interface IConnectedProps extends IBaseConnectedProps {
  selectedMods: string[];
  showOverlay: boolean;
}

type IProps = IConnectedProps & IActionProps;

class HighlightIconBar extends HighlightBase<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { t } = this.props;

    const popoverBottom = this.props.showOverlay
      ? this.renderPopover({
          toggleIcons: this.toggleIcon,
          toggleColors: this.toggleColors,
        })
      : null;

    return (
      <div style={{ height: "100%" }}>
        {this.props.showOverlay ? (
          <Overlay
            rootClose
            placement={"top"}
            onHide={this.toggleOverlay}
            show={this.props.showOverlay}
            target={this.mRef as any}
          >
            {popoverBottom}
          </Overlay>
        ) : null}
        <ToolbarIcon
          className={"highlight-default"}
          text={"Highlight Mods"}
          ref={this.setRef}
          icon={"highlight"}
          tooltip={t("Highlight your mods")}
          onClick={this.toggleOverlay}
        />
      </div>
    );
  }

  private toggleIcon = (evt) => {
    const { gameMode, selectedMods, onSetModAttributes } = this.props;

    onSetModAttributes(gameMode, selectedMods, "icon", evt.currentTarget.id);
  };

  private toggleColors = (color) => {
    const { gameMode, selectedMods, onSetModAttributes } = this.props;
    onSetModAttributes(
      gameMode,
      selectedMods,
      "color",
      color.currentTarget.value,
    );
  };

  private toggleOverlay = () => {
    const { onToggleBatchHiglighter, showOverlay } = this.props;
    onToggleBatchHiglighter(!showOverlay);
  };
}

function mapStateToProps(state: types.IState): IConnectedProps {
  return {
    selectedMods: util.getSafe(
      state,
      ["session", "modhighlight", "selectedMods"],
      [],
    ),
    showOverlay: util.getSafe(
      state,
      ["session", "modhighlight", "displayBatchHighlighter"],
      false,
    ),
    gameMode: selectors.activeGameId(state),
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, any, any>,
): IActionProps {
  return {
    onSetModAttribute: (
      gameMode: string,
      modId: string,
      attributeId: string,
      value: any,
    ) => {
      dispatch(actions.setModAttribute(gameMode, modId, attributeId, value));
    },
    onSetModAttributes: (
      gameMode: string,
      modIds: string[],
      attributeId: string,
      value: any,
    ) => {
      util.batchDispatch(
        dispatch,
        modIds.map((modId) =>
          actions.setModAttribute(gameMode, modId, attributeId, value),
        ),
      );
    },
    onToggleBatchHiglighter: (enabled: boolean) =>
      dispatch(setDisplayBatchHighlight(enabled)),
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(HighlightIconBar) as any,
) as React.ComponentClass<{}>;
