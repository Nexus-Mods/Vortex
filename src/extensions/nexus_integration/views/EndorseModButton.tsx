import { IExtensionApi } from '../../../types/IExtensionContext';
import { ComponentEx } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import * as React from 'react';

export interface IProps {
  modId: string;
  id: string;
  endorsedStatus: string;
  version: string;
  api: IExtensionApi;
  t: I18next.TranslationFunction;
  onEndorseMod: (api: IExtensionApi, endorsedStatus: string,
   modId: string, id: string, version: string) => void;
}

/**
 * Endorse Button
 * 
 * @class EndorseModButton
 */
class EndorseModButton extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {
    let {endorsedStatus, modId, t } = this.props;
    let endorseIcon = '';
    let endorseTooltip = '';
    switch (endorsedStatus) {
      case 'Undecided':
        endorseIcon = 'star-half-o';
        endorseTooltip = t('Undecided');
        break;
      case 'Abstained':
        endorseIcon = 'star-o';
        endorseTooltip = t('Abstained');
        break;
      case 'Endorsed':
        endorseIcon = 'star';
        endorseTooltip = t('Endorsed');
        break;
      default:
        endorseIcon = 'star-half-o';
        endorseTooltip = t('Undecided');
        break;
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <IconButton
          className='btn-embed'
          id={modId}
          tooltip={endorseTooltip}
          icon={endorseIcon}
          onClick={this.endorseMod}
        />
      </div>
    );
  }

  private endorseMod = () => {
    let { api, endorsedStatus, id, modId, onEndorseMod, version } = this.props;
    onEndorseMod(api, modId, id, version, endorsedStatus);
  };
}

export default EndorseModButton;
