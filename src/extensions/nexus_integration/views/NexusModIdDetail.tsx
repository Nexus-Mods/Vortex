import FormFeedback from '../../../controls/FormFeedback';
import FormInput from '../../../controls/FormInput';
import { ValidationState } from '../../../types/ITableAttribute';
import { ComponentEx } from '../../../util/ComponentEx';
import { truthy } from '../../../util/util';

import { setDownloadModInfo } from '../../download_management/actions/state';
import { setModAttribute } from '../../mod_management/actions/mods';

import { guessFromFileName } from '../util/guessModID';

import { TFunction } from 'i18next';
import * as React from 'react';
import { Button, ControlLabel, FormGroup, InputGroup } from 'react-bootstrap';
import * as Redux from 'redux';

export interface IProps {
  activeGameId: string;
  fileGameId: string;
  modId: string;
  readOnly?: boolean;
  isDownload: boolean;
  nexusModId: string;
  fileName: string;
  t: TFunction;
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

    const isIdValid = this.validate(nexusModId) === 'success';

    return (
      <div>
        <FormGroup>
          <InputGroup style={{ width: '100%' }}>
            <div style={{ position: 'relative' }}>
              <FormInput
                placeholder='i.e. 1337'
                value={nexusModId || ''}
                validate={this.validate}
                onChange={this.updateNexusModId}
                readOnly={readOnly}
              />
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

  private validate = (value: string): ValidationState => {
    return (!truthy(value) || isNaN(Number(value))) ? 'error' : 'success';
  }

  private guessNexusId = () => {
    const { fileName, activeGameId, isDownload, modId, store } = this.props;
    const guessed = guessFromFileName(fileName);
    if (guessed !== undefined) {
      if (isDownload) {
        store.dispatch(setDownloadModInfo(modId, 'nexus.ids.modId', guessed));
      } else {
        store.dispatch(setModAttribute(activeGameId, modId, 'modId', guessed));
      }
      this.forceUpdate();
    }
  }

  private updateNexusModId = (newValue) => {
    const { activeGameId, isDownload, modId, store } = this.props;
    if (isDownload) {
      store.dispatch(setDownloadModInfo(modId, 'nexus.ids.modId', parseInt(newValue, 10)));
    } else {
      store.dispatch(setModAttribute(activeGameId, modId, 'modId', parseInt(newValue, 10)));
    }
    this.forceUpdate();
  }

  private openPage = () => {
    const { fileGameId, nexusModId } = this.props;
    this.context.api.events.emit('open-mod-page', fileGameId, nexusModId, 'nexus');
  }
}

export default NexusModIdDetail;
