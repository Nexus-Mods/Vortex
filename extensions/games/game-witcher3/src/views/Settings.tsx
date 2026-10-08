import { Toggle } from "@nexusmods/vortex-api";
import React from "react";
import { ControlLabel, FormGroup, HelpBlock, Panel } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector, useStore } from "react-redux";

import { autoSortLoadOrderChanged } from "../actions";
import { AUTO_SORT_LABEL, I18N_NAMESPACE } from "../common";
import { autoSortLoadOrderEnabled } from "../selectors";

export default function Settings() {
  const { t } = useTranslation(I18N_NAMESPACE);
  const store = useStore();
  const autoSort = useSelector(autoSortLoadOrderEnabled);
  const toggleAutoSort = React.useCallback(
    (enabled: boolean) => store.dispatch(autoSortLoadOrderChanged(enabled)),
    [store],
  );

  return (
    <form>
      <FormGroup controlId="witcher3-auto-sort">
        <Panel>
          <Panel.Body>
            <ControlLabel>{t("The Witcher 3")}</ControlLabel>
            <Toggle checked={autoSort} onToggle={toggleAutoSort}>
              {t(AUTO_SORT_LABEL)}
            </Toggle>
            <HelpBlock>
              {t(
                "Sorts by mod folder name after every deployment, the order the game uses when no " +
                  "priority is set. Merged scripts stay at the top.",
              )}
            </HelpBlock>
          </Panel.Body>
        </Panel>
      </FormGroup>
    </form>
  );
}
