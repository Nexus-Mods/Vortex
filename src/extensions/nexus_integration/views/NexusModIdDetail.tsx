import { ComponentEx } from '../../../util/ComponentEx';
import FormFeedback from '../../../views/FormFeedback';
import FormInput from '../../../views/FormInput';

import { setModAttribute } from '../../mod_management/actions/mods';

import * as I18next from 'i18next';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';

export interface IProps {
  gameId: string;
  modId: string;
  readOnly: boolean;
  nexusModId: string;
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
    const { t, nexusModId, readOnly } = this.props;

    const isIdValid = (nexusModId !== undefined) && !isNaN(Number(nexusModId));

    return (
      <div>
        <FormGroup
          validationState={isIdValid ? 'success' : 'warning'}
        >
          <FormInput
            value={nexusModId || ''}
            onChange={this.updateNexusModId}
            readOnly={readOnly}
          />
          { readOnly ? null : <FormFeedback /> }
          <ControlLabel>
            {isIdValid ? <p><a onClick={this.openPage}>{t('Visit on www.nexusmods.com')}</a></p>
                       : <p>{t('Nexus Mod Ids are numbers')}</p>}
          </ControlLabel>
        </FormGroup>
      </div>
    );
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
