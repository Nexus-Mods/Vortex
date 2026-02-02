import * as React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import {
  ComponentEx,
  FlexLayout,
  selectors,
  tooltip,
  types,
  util,
} from "vortex-api";

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
            onChange={this.selectInstallMode}
            value={currentInstallMode}
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
          tooltip={t("This mod has installer options")}
        />
      </FlexLayout.Fixed>
    ) : null;
  };

  private renderOption = (option) => {
    const { t, options, modId } = this.props;
    const text = t(options[option]);
    return (
      <option key={option} value={option} data-id={modId}>
        {text}
      </option>
    );
  };

  private selectInstallMode = (evt) => {
    const { onSetInstallMode } = this.props;
    const modId: string =
      evt.target.selectedOptions[0]?.getAttribute("data-id");
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
