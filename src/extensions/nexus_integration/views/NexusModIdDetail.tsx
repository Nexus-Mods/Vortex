import { ComponentEx } from '../../../util/ComponentEx';
import FormFeedback from '../../../views/FormFeedbackAwesome';

import { setModAttribute } from '../../mod_management/actions/mods';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';

export interface IProps {
  gameId: string;
  modId: string;
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
    const { nexusModId, t } = this.props;

    const isIdValid = (nexusModId !== undefined) && !isNaN(parseInt(nexusModId, 10));

    return (
      <div>
        <FormGroup
          validationState={isIdValid ? 'success' : 'warning'}
        >
          <FormControl
            type='text'
            value={nexusModId || ''}
            onChange={this.updateNexusModId}
          />
          <FormFeedback />
          <ControlLabel>
            {isIdValid ? <p><a onClick={this.openPage}>{t('Visit on www.nexusmods.com')}</a></p>
                       : <p>{t('Nexus Mod Ids are numbers')}</p>}
          </ControlLabel>
        </FormGroup>
      </div>
    );
  }

  private updateNexusModId = (evt) => {
    const { gameId, modId, store } = this.props;
    const nexusModId = evt.currentTarget.value;

    store.dispatch(setModAttribute(gameId, modId, 'modId', nexusModId));
  };

  private openPage = () => {
    const { gameId, nexusModId } = this.props;
    this.context.api.events.emit('open-mod-page', gameId, nexusModId);
  };
}

export default NexusModIdDetail;
