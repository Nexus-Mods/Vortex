import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import Icon from '../../../views/Icon';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IMod } from '../types/IMod';

import * as React from 'react';

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  gameMode: string;
  updateRunning: boolean;
}

class CheckVersionButton extends ComponentEx<IConnectedProps, {}> {
  public render(): JSX.Element {
    let { t, updateRunning } = this.props;

    if (updateRunning) {
      return (
        <div>
          <Icon name='spinner' pulse />
        </div>
      );
    } else {
      return <ToolbarIcon
        id='check-mods-version'
        icon='calendar-check-o'
        tooltip={t('Check mods version')}
        onClick={this.checkModsVersion}
      />;
    }
  }

  private checkModsVersion = () => {
    const { gameMode, mods } = this.props;
    if (mods !== undefined) {
      this.context.api.events.emit('check-mods-version', gameMode, mods);
    }
  };
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
    connect(mapStateToProps)(CheckVersionButton)
  );
