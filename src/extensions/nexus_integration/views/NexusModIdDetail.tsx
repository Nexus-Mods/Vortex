import FormFeedback from '../../../controls/FormFeedback';
import FormInput from '../../../controls/FormInput';
import { ComponentEx } from '../../../util/ComponentEx';
import { truthy } from '../../../util/util';

import { setModAttribute } from '../../mod_management/actions/mods';

import * as I18next from 'i18next';
import * as React from 'react';
import { Button, ControlLabel, FormControl, FormGroup, InputGroup } from 'react-bootstrap';
import * as Redux from 'redux';

export interface IProps {
  gameId: string;
  modId: string;
  readOnly: boolean;
  nexusModId: string;
  fileName: string;
  t: I18next.TranslationFunction;
  store: Redux.Store<any>;
}

/**
 * Nexus Mod Id Detail
 *
 * @class NexusModIdDetail
 */
class NexusModIdDetail extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, fileName, nexusModId, readOnly } = this.props;

    const isIdValid = truthy(nexusModId) && !isNaN(Number(nexusModId));

    return (
      <div>
        <FormGroup
          validationState={isIdValid ? 'success' : 'warning'}
        >
          <InputGroup style={{ width: '100%' }}>
            <div style={{ position: 'relative' }}>
              <FormInput
                placeholder='i.e. 1337'
                value={nexusModId || ''}
                onChange={this.updateNexusModId}
                readOnly={readOnly}
              />
              {readOnly ? null : <FormFeedback />}
            </div>
            {(readOnly || isIdValid || (fileName === undefined))
              ? null
              : (<InputGroup.Button style={{ width: 'initial' }}>
                <Button onClick={this.guessNexusId}>{t('Guess')}</Button>
              </InputGroup.Button>
              )}
          </InputGroup>
          <ControlLabel>
            {isIdValid ? <p><a onClick={this.openPage}>{t('Visit on www.nexusmods.com')}</a></p>
                       : <p>{t('Nexus Mod Ids are numbers')}</p>}
          </ControlLabel>
        </FormGroup>
      </div>
    );
  }

  private guessNexusId = () => {
    const { fileName, gameId, modId, store } = this.props;
    const match = fileName.match(/-([0-9]+)-/);
    if (match !== null) {
      store.dispatch(setModAttribute(gameId, modId, 'modId', match[1]));
    }
  }

  private updateNexusModId = (newValue) => {
    const { gameId, modId, store } = this.props;

    store.dispatch(setModAttribute(gameId, modId, 'modId', newValue));
  }

  private openPage = () => {
    const { gameId, nexusModId } = this.props;
    this.context.api.events.emit('open-mod-page', gameId, nexusModId);
  }
}

export default NexusModIdDetail;
