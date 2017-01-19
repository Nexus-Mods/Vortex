import { IExtensionApi } from '../../../types/IExtensionContext';
import { ComponentEx } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import * as React from 'react';

interface IProps {
  modId: string;
  isEndorsed: boolean;
  api: IExtensionApi;
  t: I18next.TranslationFunction;
  onEndorseMod: (api: IExtensionApi, isEndorsed: boolean, modId: string) => void;
}

/**
 * Endorse Button
 * 
 * @class EndorseModButton
 */
class EndorseModButton extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {
    let {isEndorsed, modId, t } = this.props;

    return (
      <div style={{ textAlign: 'center' }}>
        <IconButton
          className='btn-embed'
          id={modId}
          tooltip={t('Endorse')}
          icon={isEndorsed ? 'star' : 'star-o'}
          onClick={this.endorseMod}
        />
      </div>
    );
  }

  private endorseMod = () => {
    let { api, isEndorsed, modId, onEndorseMod } = this.props;
    onEndorseMod(api, isEndorsed, modId);
  };
}

export default EndorseModButton;
