import path from 'path';
import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Button, FormGroup, ControlLabel, InputGroup, FormControl, HelpBlock, Panel, Label } from 'react-bootstrap';
import { Icon, More, util } from 'vortex-api';

import { GAME_ID, I18N_NAMESPACE } from './common';

interface IProps {
  onSelectUDF: () => Promise<string>;
}

interface IConnectedProps {
  udf: string;
}

export default function Settings(props: IProps) {
  const { t } = useTranslation(I18N_NAMESPACE);
  const { onSelectUDF } = props;
  const connectedProps = useSelector(mapStateToProps);
  const [currentUDF, setUDF] = React.useState<string>(path.join(connectedProps.udf, 'Mods'));

  const onSelectUDFHandler = React.useCallback(() => {
    onSelectUDF().then((res) => {
      if (res) {
        setUDF(path.join(res, 'Mods'));
      }
    });
  }, [onSelectUDF]);
  return (
    <form id={`${GAME_ID}-settings-form`}>
      <FormGroup controlId='default-enable'>
        <ControlLabel className={`${GAME_ID}-settings-heading`}>{t('7DTD Settings')}</ControlLabel>
        <Panel key={`${GAME_ID}-user-default-folder`}>
          <Panel.Body>
            <ControlLabel className={`${GAME_ID}-settings-subheading`}>
              {t('Current User Default Folder')}
              <More id='more-udf' name={t('Set User Data Folder')} >
                {t('This will allow you to re-select the User Data Folder (UDF) for 7 Days to Die.')}
              </More>
            </ControlLabel>
            <InputGroup>
              <FormControl
                className='install-path-input'
                disabled={true}
                value={currentUDF}
              />
              <Button
                onClick={onSelectUDFHandler}
              >
                <Icon name='browse' />
              </Button>
            </InputGroup>
          </Panel.Body>
        </Panel>
      </FormGroup>
    </form>
  );
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    udf: util.getSafe(state, ['settings', '7daystodie', 'udf'], ''),
  };
}