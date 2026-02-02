import * as React from "react";
import { Overlay } from "react-bootstrap";
import * as ReactDOM from "react-dom";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import { ThunkDispatch } from "redux-thunk";
import { actions, selectors, tooltip, types, util } from "vortex-api";

import {
  HighlightBase,
  IBaseConnectedProps,
  IBaseActionProps,
} from "../types/types";

export interface IBaseProps {
  mod: types.IMod;
}

type IProps = IBaseProps & IBaseConnectedProps & IBaseActionProps;

interface IComponentState {
  showOverlay: boolean;
  up: boolean;
}

/**
 * Highlight Button
 *
 * @class HighlightButton
 */
class HighlightButton extends HighlightBase<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({ showOverlay: false, up: false });
  }

  public render(): JSX.Element {
    const { mod, t } = this.props;

    if (mod.state !== "installed") {
      return null;
    }

    const color = util.getSafe(mod.attributes, ["color"], "");
    const icon = util.getSafe(mod.attributes, ["icon"], "");

    const popoverBottom = this.state.showOverlay
      ? this.renderPopover({
          toggleIcons: this.toggleIcon,
          toggleColors: this.toggleColors,
        })
      : null;

    return (
      <div style={{ textAlign: "center" }}>
        {this.state.showOverlay ? (
          <Overlay
            rootClose
            placement={this.state.up ? "top" : "bottom"}
            onHide={this.toggleOverlay}
            show={this.state.showOverlay}
            target={this.mRef as any}
          >
            {popoverBottom}
          </Overlay>
        ) : null}
        <tooltip.IconButton
          ref={this.setRef}
          className={
            "highlight-base " + (color !== "" ? color : "highlight-default")
          }
          icon={icon !== "" ? icon : "highlight"}
          id={mod.id}
          tooltip={t("Change Icon")}
          onClick={this.toggleOverlay}
        />
      </div>
    );
  }

  private toggleIcon = (evt) => {
    const { gameMode, mod, onSetModAttribute } = this.props;
    onSetModAttribute(gameMode, mod.id, "icon", evt.currentTarget.id);
  };

  private toggleColors = (color) => {
    const { gameMode, mod, onSetModAttribute } = this.props;
    onSetModAttribute(gameMode, mod.id, "color", color.currentTarget.value);
  };

  private toggleOverlay = () => {
    this.nextState.showOverlay = !this.state.showOverlay;
    const node = ReactDOM.findDOMNode(this.mRef) as Element;
    const bounds = this.bounds;
    this.nextState.up =
      node.getBoundingClientRect().bottom >
      ((bounds.top + bounds.height) * 2) / 3;
  };
}

function mapStateToProps(state: types.IState): IBaseConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, any, any>,
): IBaseActionProps {
  return {
    onSetModAttribute: (
      gameMode: string,
      modId: string,
      attributeId: string,
      value: any,
    ) => {
      dispatch(actions.setModAttribute(gameMode, modId, attributeId, value));
    },
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(HighlightButton) as any,
) as React.ComponentClass<IBaseProps>;
