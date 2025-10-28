import Toggle from '../../../controls/Toggle';
import { IState } from '../../../types/IState';

import { setInstallerSandbox } from '../actions/settings';

import React, { useContext } from 'react';
import { Alert, ControlLabel, FormGroup } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { MainContext } from '../../../views/MainWindow';

export interface IWorkaroundsProps {
  osSupportsAppContainer: boolean;
}

function Workarounds(props: IWorkaroundsProps): React.ReactElement<any, any> {
  const { osSupportsAppContainer } = props;
  const { t } = useTranslation();

  const sandboxEnabled =
    useSelector((state: IState) => state.settings.mods.installerSandbox ?? true);
  const dispatch = useDispatch();

  const context = useContext(MainContext);

  const toggleSandbox = React.useCallback(() => {
    if (osSupportsAppContainer) {
      context.api.events.emit('analytics-track-click-event',
                              'Workarounds',
                              sandboxEnabled ? 'Disable Sandbox' : 'Enable Sandbox');
      dispatch(setInstallerSandbox(!sandboxEnabled));
    }
  }, [sandboxEnabled]);

  return (
    <form>
      <FormGroup id='dotnet-appcontainer' controlId='appcontainer'>
        <ControlLabel>{t('Installer Sandbox')}</ControlLabel>
        <Toggle
          checked={sandboxEnabled && osSupportsAppContainer}
          onToggle={toggleSandbox}
          disabled={!osSupportsAppContainer}
        >
          {t('Enable Sandbox')}
        </Toggle>
      </FormGroup>
    </form>
  );
}

export default Workarounds;
