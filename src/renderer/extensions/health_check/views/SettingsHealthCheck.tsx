import React from "react";
import { ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import Toggle from "../../../controls/Toggle";
import { setModRequirementsEnabled } from "../actions/persistent";
import { isModRequirementsEnabled } from "../selectors";

const SettingsHealthCheck: React.FC = () => {
  const { t } = useTranslation(["health_check"]);
  const dispatch = useDispatch();
  const enabled = useSelector(isModRequirementsEnabled);

  const onToggle = React.useCallback(() => {
    dispatch(setModRequirementsEnabled(!enabled));
  }, [dispatch, enabled]);

  return (
    <form>
      <FormGroup controlId="health-check-settings">
        <ControlLabel>{t("settings::title")}</ControlLabel>

        <HelpBlock>{t("settings::description")}</HelpBlock>

        <Toggle checked={enabled} onToggle={onToggle}>
          {t("settings::mod_requirements")}
        </Toggle>
      </FormGroup>
    </form>
  );
};

export default SettingsHealthCheck;
