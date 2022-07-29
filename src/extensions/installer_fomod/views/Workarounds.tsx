import Toggle from '../../../controls/Toggle';
import { IState } from '../../../types/IState';

import { setInstallerSandbox } from '../actions/settings';

import React from 'react';
import { Alert, ControlLabel, FormGroup } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

export interface IWorkaroundsProps {
  osSupportsAppContainer: boolean;
}

function Workarounds(props: IWorkaroundsProps): React.ReactElement<any, any> {
  const { osSupportsAppContainer } = props;
  const { t } = useTranslation();

  const sandboxEnabled =
    useSelector((state: IState) => state.settings.mods.installerSandbox ?? true);
  const dispatch = useDispatch();

  const toggleSandbox = React.useCallback(() => {
    if (osSupportsAppContainer) {
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
        <Alert bsStyle='warning'>
          {t('Without the sandbox a specific type of mod installers could '
            + 'maliciously harm your system.')}
          <br/>
          {t('This requires windows 8+ and for unknown (atm) reasons it '
            + 'doesn\'t work for some users.')}
        </Alert>
      </FormGroup>
    </form>
  );
}

export default Workarounds;
