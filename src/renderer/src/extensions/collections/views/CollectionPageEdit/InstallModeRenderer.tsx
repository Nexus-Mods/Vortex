import * as React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";

import { FlexLayout, tooltip } from "../../../../controls/api";
import { ComponentEx } from "../../../../controls/ComponentEx";
import type * as types from "../../../../types/api";
import * as util from "../../../../util/api";
import * as selectors from "../../../../util/selectors";
import { NAMESPACE } from "../../constants";

interface IBaseProps {
  modId: string;
  currentInstallMode: string;
  options: { [key: string]: string };
  hasInstallerOptions: boolean;
  onSetInstallMode: (id: string, value: string) => void;
}

interface IConnectedProps {
  mods: { [modId: string]: types.IMod };
}

type IProps = IBaseProps & IConnectedProps;

class InstallModeRenderer extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { options, currentInstallMode } = this.props;
    return (
      <FlexLayout type="row">
        <FlexLayout.Fixed>
          <FormControl
            componentClass="select"
            value={currentInstallMode}
            onChange={this.selectInstallMode}
          >
            {Object.keys(options).map(this.renderOption)}
          </FormControl>
        </FlexLayout.Fixed>

        {this.renderIconTooltip()}
      </FlexLayout>
    );
  }

  private renderIconTooltip = () => {
    const { t, hasInstallerOptions } = this.props;
    return hasInstallerOptions ? (
      <FlexLayout.Fixed style={{ marginLeft: "5px", marginTop: "3px" }}>
        <tooltip.Icon
          name="options"
          set="collections"
          tooltip={t("This mod has installer options")}
        />
      </FlexLayout.Fixed>
    ) : null;
  };

  private renderOption = (option) => {
    const { t, options, modId } = this.props;
    const text = t(options[option]);
    return (
      <option data-id={modId} key={option} value={option}>
        {text}
      </option>
    );
  };

  private selectInstallMode = (evt) => {
    const { onSetInstallMode } = this.props;
    const modId: string = evt.target.selectedOptions[0]?.getAttribute("data-id");
    const newVal: string = evt.target.value;
    onSetInstallMode(modId, newVal);
  };
}

function mapStateToProps(state: types.IState): IConnectedProps {
  const activeGameId = selectors.activeGameId(state);
  return {
    mods: util.getSafe(state, ["persistent", "mods", activeGameId], {}),
  };
}

export default withTranslation([NAMESPACE, "common"])(
  connect(mapStateToProps)(InstallModeRenderer) as any,
) as React.ComponentClass<IBaseProps>;
