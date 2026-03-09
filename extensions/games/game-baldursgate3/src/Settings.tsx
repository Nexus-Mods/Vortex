import React from 'react';
import { ControlLabel, FormGroup, HelpBlock, Panel } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useSelector, useStore } from 'react-redux';
import { Toggle, types } from 'vortex-api';
import { setAutoExportLoadOrder } from './actions';

function Settings() {

  const store = useStore();

  const autoExportLoadOrder = useSelector((state: types.IState) =>
    state.settings['baldursgate3']?.autoExportLoadOrder);

  const setUseAutoExportLoadOrderToGame = React.useCallback((enabled: boolean) => {
    console.log(`setAutoExportLoadOrder=${enabled}`)
    store.dispatch(setAutoExportLoadOrder(enabled));
  }, []);
  
  const { t } = useTranslation();

  return (
    <form>
      <FormGroup controlId='default-enable'>
        <Panel>
          <Panel.Body>
            <ControlLabel>{t('Baldur\'s Gate 3')}</ControlLabel>
            <Toggle
              checked={autoExportLoadOrder}
              onToggle={setUseAutoExportLoadOrderToGame}
            >
              {t('Auto export load order')}
            </Toggle>
            <HelpBlock>
              {t(`If enabled, when Vortex saves it's load order, it will also update the games load order. 
              If disabled, and you wish the game to use your load order, then this will need to be completed 
              manually using the Export to Game button on the load order screen`)}
            </HelpBlock>
          </Panel.Body>
        </Panel>
      </FormGroup>
    </form>
  );
}

export default Settings;
