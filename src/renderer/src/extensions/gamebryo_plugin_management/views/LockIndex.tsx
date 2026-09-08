import * as React from "react";
import { ControlLabel, FormControl, FormGroup, Radio } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import type * as Redux from "redux";

import { ComponentEx } from "../../../controls/ComponentEx";
import FlexLayout from "../../../controls/FlexLayout";
import type { IState } from "../../../types/IState";
import { getSafe } from "../../../util/storeHelper";
import { lockPluginIndex } from "../actions/indexlock";
import { NAMESPACE } from "../statics";
import type { IPluginCombined } from "../types/IPlugins";

// look translations up in the extension namespace first, then the pre-fold extension's own
// namespace so existing community translation packs keep working
const NS_CHAIN = [NAMESPACE, "gamebryo-lockindex"];

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
  plugin: IPluginCombined;
}

interface IConnectedProps {
  lockedIndex: number;
}

interface IActionProps {
  onLockPluginIndex: (gameId: string, pluginName: string, modIndex: number) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LockIndex extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, lockedIndex } = this.props;
    return (
      <FlexLayout type="column">
        <Radio
          name="lockedGroup"
          checked={lockedIndex === undefined}
          data-value="automatic"
          onChange={this.onToggleEvt}
        >
          {t("Sorted automatically", { ns: NS_CHAIN })}
        </Radio>
        <Radio
          name="lockedGroup"
          checked={lockedIndex !== undefined}
          data-value="locked"
          onChange={this.onToggleEvt}
        >
          {t("Locked to index", { ns: NS_CHAIN })}
        </Radio>
        {this.renderIndex()}
      </FlexLayout>
    );
  }

  private renderIndex(): JSX.Element {
    const { t, lockedIndex, plugin } = this.props;

    const matched = lockedIndex === undefined || plugin.modIndex === lockedIndex;

    return (
      <FormGroup validationState={matched ? "success" : "error"}>
        <FormControl
          type="text"
          value={lockedIndex !== undefined ? toHex(lockedIndex) : ""}
          placeholder={t("Automatic", { ns: NS_CHAIN })}
          onChange={this.setIndex}
          disabled={lockedIndex === undefined}
        />
        {matched ? null : (
          <ControlLabel style={{ maxWidth: 250 }}>
            {t(
              "Actual index differs. If this is the case after sorting it may be " +
                "this index isn't possible.",
              { ns: NS_CHAIN },
            )}
          </ControlLabel>
        )}
      </FormGroup>
    );
  }

  private onToggle = (newValue: boolean) => {
    const { gameMode, onLockPluginIndex, plugin } = this.props;
    onLockPluginIndex(gameMode, plugin.name.toLowerCase(), newValue ? plugin.modIndex : undefined);
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

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const statePath = [
    "persistent",
    "plugins",
    "lockedIndices",
    ownProps.gameMode,
    ownProps.plugin.name.toLowerCase(),
  ];
  return {
    lockedIndex: getSafe(state, statePath, undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onLockPluginIndex: (gameId: string, pluginId: string, modIndex: number) =>
      dispatch(lockPluginIndex(gameId, pluginId, modIndex)),
  };
}

export default withTranslation(["common", ...NS_CHAIN])(
  connect(mapStateToProps, mapDispatchToProps)(LockIndex) as any,
) as React.ComponentClass<IBaseProps>;
