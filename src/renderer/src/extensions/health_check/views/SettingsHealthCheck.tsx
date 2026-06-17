import React from "react";
import { ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import Toggle from "../../../controls/Toggle";
import { setModRequirementsEnabled, setFileRequirementsEnabled } from "../actions/persistent";
import {
  isModRequirementsEnabled,
  isFileRequirementsEnabled,
  isFileRequirementsFeatureAvailable,
} from "../selectors";

const SettingsHealthCheck: React.FC = () => {
  const { t } = useTranslation(["health_check"]);
  const dispatch = useDispatch();
  const modRequirementsEnabled = useSelector(isModRequirementsEnabled);
  const fileRequirementsEnabled = useSelector(isFileRequirementsEnabled);
  const fileRequirementsAvailable = useSelector(isFileRequirementsFeatureAvailable);

  const onToggleModRequirements = React.useCallback(() => {
    dispatch(setModRequirementsEnabled(!modRequirementsEnabled));
  }, [dispatch, modRequirementsEnabled]);

  const onToggleFileRequirements = React.useCallback(() => {
    dispatch(setFileRequirementsEnabled(!fileRequirementsEnabled));
  }, [dispatch, fileRequirementsEnabled]);

  return (
    <form>
      <FormGroup controlId="health-check-settings">
        <ControlLabel>{t("settings::title")}</ControlLabel>

        <HelpBlock>{t("settings::description")}</HelpBlock>

        <Toggle checked={modRequirementsEnabled} onToggle={onToggleModRequirements}>
          {t("settings::mod_requirements")}
        </Toggle>

        {fileRequirementsAvailable && (
          <Toggle checked={fileRequirementsEnabled} onToggle={onToggleFileRequirements}>
            {t("settings::file_requirements")}
          </Toggle>
        )}
      </FormGroup>
    </form>
  );
};

export default SettingsHealthCheck;
