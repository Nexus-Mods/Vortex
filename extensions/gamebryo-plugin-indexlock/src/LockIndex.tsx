import { lockPluginIndex } from "./actions";
import { IPlugin } from "./types";

import * as React from "react";
import { ControlLabel, FormControl, FormGroup, Radio } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ComponentEx, FlexLayout, Toggle, types, util } from "vortex-api";

function toHex(input: number) {
  if (input === undefined) {
    return "FF";
  }
  let res = input.toString(16).toUpperCase();
  if (res.length < 2) {
    res = "0" + res;
  }
  return res;
}

export interface IBaseProps {
  gameMode: string;
  plugin: IPlugin;
}

interface IConnectedProps {
  lockedIndex: number;
}

interface IActionProps {
  onLockPluginIndex: (
    gameId: string,
    pluginName: string,
    modIndex: number,
  ) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LockIndex extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, lockedIndex } = this.props;
    const title =
      lockedIndex !== undefined
        ? t("Locked to index", { replace: { lockedIndex: toHex(lockedIndex) } })
        : t("Sorted automatically");
    return (
      <FlexLayout type="column">
        <Radio
          name="lockedGroup"
          checked={lockedIndex === undefined}
          data-value="automatic"
          onChange={this.onToggleEvt}
        >
          {t("Sorted automatically")}
        </Radio>
        <Radio
          name="lockedGroup"
          checked={lockedIndex !== undefined}
          data-value="locked"
          onChange={this.onToggleEvt}
        >
          {t("Locked to index")}
        </Radio>
        {this.renderIndex()}
      </FlexLayout>
    );
  }

  private renderIndex(): JSX.Element {
    const { t, lockedIndex, plugin } = this.props;

    const matched =
      lockedIndex === undefined || plugin.modIndex === lockedIndex;

    return (
      <FormGroup validationState={matched ? "success" : "error"}>
        <FormControl
          type="text"
          value={lockedIndex !== undefined ? toHex(lockedIndex) : ""}
          placeholder={t("Automatic")}
          onChange={this.setIndex}
          disabled={lockedIndex === undefined}
        />
        {matched ? null : (
          <ControlLabel style={{ maxWidth: 250 }}>
            {t(
              "Actual index differs. If this is the case after sorting it may be " +
                "this index isn't possible.",
            )}
          </ControlLabel>
        )}
      </FormGroup>
    );
  }

  private onToggle = (newValue: boolean, dataId?: string) => {
    const { gameMode, onLockPluginIndex, plugin } = this.props;
    onLockPluginIndex(
      gameMode,
      plugin.name.toLowerCase(),
      newValue ? plugin.modIndex : undefined,
    );
    this.forceUpdate();
  };

  private onToggleEvt = (evt: React.FormEvent<any>) => {
    const value = evt.currentTarget.getAttribute("data-value");
    this.onToggle(value === "locked");
  };

  private setIndex = (evt) => {
    const { gameMode, onLockPluginIndex, plugin } = this.props;
    const newValue = Number.parseInt(evt.currentTarget.value, 16);
    if (!isNaN(newValue) && newValue <= 0xff) {
      onLockPluginIndex(gameMode, plugin.name.toLowerCase(), newValue);
    }
  };
}

function mapStateToProps(
  state: types.IState,
  ownProps: IBaseProps,
): IConnectedProps {
  const statePath = [
    "persistent",
    "plugins",
    "lockedIndices",
    ownProps.gameMode,
    ownProps.plugin.name.toLowerCase(),
  ];
  return {
    lockedIndex: util.getSafe(state, statePath, undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any, any>): IActionProps {
  return {
    onLockPluginIndex: (gameId: string, pluginId: string, modIndex: number) =>
      dispatch(lockPluginIndex(gameId, pluginId, modIndex)),
  };
}

export default withTranslation(["common", "gamebryo-lockindex"])(
  connect(mapStateToProps, mapDispatchToProps)(LockIndex) as any,
) as React.ComponentClass<IBaseProps>;
