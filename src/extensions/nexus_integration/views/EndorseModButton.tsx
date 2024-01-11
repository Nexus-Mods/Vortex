import Icon from '../../../controls/Icon';
import Spinner from '../../../controls/Spinner';
import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx } from '../../../util/ComponentEx';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IProps {
  gameId: string;
  modId: string;
  endorsedStatus: string;
  t: TFunction;
  onEndorseMod: (gameId: string, modId: string, endorsedStatus) => void;
}

/**
 * Endorse Button
 *
 * @class EndorseModButton
 */
class EndorseModButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const {endorsedStatus, modId, t } = this.props;

    if (endorsedStatus === 'pending') {
      return (
        <div style={{ textAlign: 'center' }}>
          <Spinner />
        </div>
      );
    }

    const { icon, tooltip } = {
      undecided: { icon: 'endorse-maybe', tooltip: t('Undecided') },
      abstained: { icon: 'endorse-maybe', tooltip: t('Abstained') },
      endorsed: { icon: 'endorse-yes', tooltip: t('Endorsed') },
      disabled: { icon: 'endorse-disabled', tooltip: t('Endorsement disabled by author') },
    }[endorsedStatus.toLowerCase()] || { icon: 'like-maybe', tooltip: t('Undecided') };

    return (
      <div style={{ textAlign: 'center' }}>
        <IconButton
          className='btn-embed'
          id={modId}
          tooltip={tooltip}
          icon={icon}
          onClick={this.endorseMod}
          disabled={endorsedStatus === 'Disabled'}
          stroke
        />
      </div>
    );
  }

  private endorseMod = () => {
    const { endorsedStatus, gameId, modId, onEndorseMod } = this.props;
    onEndorseMod(gameId, modId, endorsedStatus);
  }
}

export default EndorseModButton;
