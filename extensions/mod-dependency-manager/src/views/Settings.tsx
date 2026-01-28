import * as React from "react";
import { Alert, ControlLabel, FormGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Toggle, types, util } from "vortex-api";

export interface IBaseProps {
  onSetModTypeConflicts: (enable: boolean) => Promise<void>;
}

interface IConnectedProps {
  modTypeConflictsEnabled: boolean;
}

export default function Settings(props: IBaseProps): JSX.Element {
  const { t } = useTranslation();
  const { onSetModTypeConflicts } = props;
  const connectedProps: IConnectedProps = useSelector(mapStateToProps);
  const modTypeConflictsEnabled = connectedProps.modTypeConflictsEnabled;
  const [modTypeConflicts, setModTypeConflicts] = React.useState(
    modTypeConflictsEnabled,
  );

  const onToggle = React.useCallback(
    (newVal) => {
      onSetModTypeConflicts(newVal);
    },
    [onSetModTypeConflicts, setModTypeConflicts],
  );

  React.useEffect(() => {
    setModTypeConflicts(modTypeConflictsEnabled);
  }, [modTypeConflictsEnabled]);

  return (
    <form>
      <FormGroup controlId="mod-dependency-manager-modtype-conflicts">
        <ControlLabel>{t("Cross-ModType Conflicts Detection")}</ControlLabel>
        {modTypeConflicts ? (
          <Alert bsStyle="warning">
            {t(
              "Disabling this feature is not recommended. If you have ModType conflicts present in your mods setup, disabling this " +
                "will result in the External Changes Dialog being raised before any deployment/purge event and " +
                "certain files not being deployed/purged correctly " +
                "until you manually resolve the conflict. Please proceed with caution.",
            )}
          </Alert>
        ) : (
          <Alert bsStyle="warning">
            {t(
              "You have disabled Cross-ModType conflict detection on your system. Any conflicts across modtypes will " +
                "have to be resolved manually outside of Vortex.",
            )}
          </Alert>
        )}
        <Toggle checked={modTypeConflicts} onToggle={onToggle}>
          {t(
            "Enable/Disable Cross-ModType conflict detection (A purge will execute upon change)",
          )}
        </Toggle>
      </FormGroup>
    </form>
  );
}

function mapStateToProps(state: types.IState): IConnectedProps {
  return {
    modTypeConflictsEnabled: util.getSafe(
      state,
      ["settings", "workarounds", "modTypeConflictsEnabled"],
      true,
    ),
  };
}
