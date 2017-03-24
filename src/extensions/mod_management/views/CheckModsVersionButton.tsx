import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { IMod } from '../types/IMod';

import * as React from 'react';

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  gameMode: string;
}

class CheckVersionButton extends ComponentEx<IConnectedProps, {}> {
  public render(): JSX.Element {
    let { t } = this.props;

    return <ToolbarIcon
      id='check-mods-version'
      icon='calendar-check-o'
      tooltip={t('Check mods version')}
      onClick={this.checkModsVersion}
    />;
  }

  private checkModsVersion = () => {
    const { gameMode, mods } = this.props;
    if (mods !== undefined) {
      Object.keys(mods).forEach((key: string) => {
        return new Promise<void>((resolve, reject) => {
          this.context.api.events.emit('check-mods-version',
            gameMode, mods[key]);
        });
      });
    }
  };
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    mods: state.persistent.mods[gameMode] || {},
    gameMode,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(CheckVersionButton)
  );
