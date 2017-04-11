import { ComponentEx } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import { setModAttribute } from '../../mod_management/actions/mods';

import * as React from 'react';
import { FormControl } from 'react-bootstrap';

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
        <div>
          <FormControl
              type='text'
              value={nexusModId}
              onChange={this.updateNexusModId}
          />
          <IconButton
            className='btn-version-column'
            id={modId}
            tooltip={t('Visit che corresponding Nexus mod page')}
            icon='external-link'
            onClick={this.openPage}
          />
        </div>
      );
    } else {
      return (
        <div>
          <FormControl
              type='text'
              value={nexusModId}
              onChange={this.updateNexusModId}
          />
          <IconButton
            className='btn-version-column'
            id={modId}
            tooltip={t('Nexus Mod Id is empty')}
            icon='ban'
          />
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
