import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';

import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';

import * as React from 'react';

export type IModWithState = IMod & IProfileMod;

export interface IBaseProps {
  buttonType: ButtonType;
}

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  gameMode: string;
  updateRunning: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class CheckVersionsButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType, updateRunning } = this.props;

    if (updateRunning) {
      return (
        <ToolbarIcon
          id='check-mods-version'
          icon='spinner'
          text={t('Checking for mod updates')}
          buttonType={buttonType}
          disabled={true}
        />
      );
    } else {
      return (
        <ToolbarIcon
          id='check-mods-version'
          icon='cloud-refresh'
          text={t('Check for mod updates')}
          onClick={this.checkModsVersion}
          buttonType={buttonType}
        />
      );
    }
  }

  private checkModsVersion = () => {
    const { gameMode, mods } = this.props;

    this.context.api.events.emit('check-mods-version', gameMode, mods);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    mods: state.persistent.mods[gameMode] || {},
    gameMode,
    updateRunning: state.settings.mods.updatingMods[gameMode],
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(
      CheckVersionsButton)) as React.ComponentClass<IBaseProps>;
