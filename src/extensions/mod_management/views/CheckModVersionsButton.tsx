import { ButtonType } from '../../../controls/IconBar';
import ToolbarDropdown from '../../../controls/ToolbarDropdown';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

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
    const { t, updateRunning } = this.props;

    if (updateRunning) {
      return (
        <ToolbarIcon
          id='check-mods-version'
          icon='spinner_new'
          text={t('Checking for mod updates')}
          disabled={true}
          spin
        />
      );
    } else {
      const id = 'check-mod-updates-button';

      return (
        <ToolbarDropdown
          t={t}
          key={id}
          id={id}
          instanceId={[]}
          icons={[
            {
              icon: 'refresh',
              title: 'Check for Updates (Optimized)',
              action: () => this.checkForUpdates(),
              default: true,
            }, {
              icon: 'refresh',
              title: 'Check for Updates (Full)',
              action: () => this.checkForUpdates(true),
            },
            {
              icon: 'download',
              title: 'Check for Updates (Apply All Updates)',
              action: () => this.dispatchCheckModsVersionEvent(true)
                .then((modIds: string[]) => this.updateAll(modIds)),
            }
          ]}
          orientation={'horizontal'}
        />
      );
    }
  }

  private raiseUpdateAllNotification = (modIds: string[]) => {
    this.context.api.sendNotification({
      type: 'success',
      message: 'Check for mod updates complete ({{count}} update/s found)',
      replace: {
        count: modIds.length,
      },
      actions: modIds.length > 0 ? [
        {
          title: 'Update All',
          action: (dismiss) => {
            dismiss();
            this.updateAll(modIds)
          },
        },
      ] : null,
    })
  }

  private dispatchCheckModsVersionEvent = async (force: boolean): Promise<string[]> => {
    const { mods, gameMode} = this.props;
    try {
      const modIdsResults: string[][] = await this.context.api.emitAndAwait('check-mods-version', gameMode, mods, force);
      const modIds = modIdsResults
        .filter(iter => iter !== undefined)
        .reduce((prev: string[], iter: string[]) => [...prev, ...iter], []);
      return Promise.resolve(modIds);
    } catch (error) {
      this.context.api.showErrorNotification('Error checking for mod updates', error);
      return Promise.resolve([]);
    }
  }

  private checkForUpdates = (force: boolean = false) => {
    this.dispatchCheckModsVersionEvent(force)
      .then((modIds: string[]) => {
        this.raiseUpdateAllNotification(modIds);
      });
  }

  private updateAll = (modIds: string[]) => {
    const { gameMode } = this.props;
    this.context.api.events.emit('mods-update', gameMode, modIds);
  }
}

const emptyObject = {};

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    mods: getSafe(state, ['persistent', 'mods', gameMode], emptyObject),
    gameMode,
    updateRunning: getSafe(state, ['session', 'mods', 'updatingMods', gameMode], false),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(
      CheckVersionsButton)) as React.ComponentClass<IBaseProps>;
