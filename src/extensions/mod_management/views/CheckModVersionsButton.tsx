import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import { ButtonType } from '../../../views/IconBar';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';

import * as React from 'react';

export type IModWithState = IMod & IProfileMod;

export interface IBaseProps {
  groupedMods: { [id: string]: IModWithState[] };
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
          text={t('Check mods version')}
          buttonType={buttonType}
          disabled={true}
          pulse={true}
        />
      );
    } else {
      return (
        <ToolbarIcon
          id='check-mods-version'
          icon='calendar-add'
          text={t('Check mods version')}
          onClick={this.checkModsVersion}
          buttonType={buttonType}
        />
      );
    }
  }

  private checkModsVersion = () => {
    const { gameMode, groupedMods, mods } = this.props;

    if (groupedMods !== undefined) {
      this.context.api.events.emit('check-mods-version', gameMode, groupedMods, mods);
    }
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
