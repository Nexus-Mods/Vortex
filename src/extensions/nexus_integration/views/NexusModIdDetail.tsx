import { ComponentEx } from '../../../util/ComponentEx';
import FormFeedback from '../../../views/FormFeedbackAwesome';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { setModAttribute } from '../../mod_management/actions/mods';

import * as React from 'react';
import { FormControl, FormGroup, InputGroup } from 'react-bootstrap';

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
    const { modId, nexusModId, t } = this.props;

    if (nexusModId !== undefined && nexusModId !== '') {
      return (
        <InputGroup>
          <FormControl
            type='text'
            value={nexusModId}
            onChange={this.updateNexusModId}
          />
          <InputGroup.Button>
            <Button
              id={modId}
              tooltip={t('Visit che corresponding Nexus mod page')}
              onClick={this.openPage}
            >
              <Icon name='external-link' />
            </Button>
          </InputGroup.Button>
        </InputGroup>
      );
    } else {
      return (
        <div>
          <FormGroup
            validationState={'warning'}
          >
            <FormControl
              type='text'
              value={nexusModId}
              onChange={this.updateNexusModId}
            />
            <FormFeedback />
          </FormGroup>
        </div>
      );
    }
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
