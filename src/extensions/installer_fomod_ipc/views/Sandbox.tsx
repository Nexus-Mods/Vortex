import React, { useContext } from "react";
import { Alert, ControlLabel, FormGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setInstallerSandbox } from "../actions/sandbox";
import type { IState } from "../../../types/IState";
import { MainContext } from "../../../renderer/views/ApplicationLayout";
import Toggle from "../../../renderer/controls/Toggle";

export interface IWorkaroundsProps {
  osSupportsAppContainer: boolean;
}

function Sandbox(props: IWorkaroundsProps): React.ReactElement<any, any> {
  const { osSupportsAppContainer } = props;
  const { t } = useTranslation();

  const sandboxEnabled = useSelector(
    (state: IState) => state.settings.mods.installerSandbox ?? true,
  );
  const dispatch = useDispatch();

  const context = useContext(MainContext);

  const toggleSandbox = React.useCallback(() => {
    if (osSupportsAppContainer) {
      context.api.events.emit(
        "analytics-track-click-event",
        "Workarounds",
        sandboxEnabled ? "Disable Sandbox" : "Enable Sandbox",
      );
      dispatch(setInstallerSandbox(!sandboxEnabled));
    }
  }, [sandboxEnabled]);

  return (
    <form>
      <FormGroup id="dotnet-appcontainer" controlId="appcontainer">
        <ControlLabel>{t("Installer Sandbox")}</ControlLabel>
        <Toggle
          checked={sandboxEnabled && osSupportsAppContainer}
          onToggle={toggleSandbox}
          disabled={!osSupportsAppContainer}
        >
          {t("Enable Sandbox")}
        </Toggle>
      </FormGroup>
    </form>
  );
}

export default Sandbox;
