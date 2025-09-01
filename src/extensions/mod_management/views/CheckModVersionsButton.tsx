import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';

import { IProfileMod } from '../../profile_management/types/IProfile';

import { IMod } from '../types/IMod';

import * as React from 'react';
import updateState from '../util/modUpdateState';

export type IModWithState = IMod & IProfileMod;

export interface IBaseProps {
  buttonType: ButtonType;
}

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  gameMode: string;
  updateRunning: boolean;
  isPremium: boolean;
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
        <ToolbarIcon
          id={id}
          icon='refresh'
          text={t('Check for Updates')}
          onClick={this.checkForUpdatesAndInstall}
        />
      );
    }
  }

  
  private raiseUpdateAllNotification = (modIds: string[]) => {
    this.context.api.sendNotification({
      id: 'check-mods-version-complete',
      type: 'success',
      message: 'Check for mod updates complete ({{count}} update/s outstanding)',
      replace: {
        count: modIds.length,
      },
      actions: this.props.isPremium && modIds.length > 0 ? [
        {
          title: 'Update All',
          action: (dismiss) => {
            dismiss();
            this.updateAll(modIds)
          },
        },
      ] : undefined,
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

  private checkForUpdatesAndInstall = () => {
    return this.dispatchCheckModsVersionEvent(true)
      .then((_) => {
        const outdatedModIds = Object.keys(this.props.mods).filter(modId => {
          const mod = this.props.mods[modId];
          const state = updateState(mod.attributes);
          return state === 'update' && mod.type !== 'collection';
        });
        return Array.from(new Set<string>([].concat(outdatedModIds)));
      })
      .then((modIds: string[]) => {
        this.raiseUpdateAllNotification(modIds);
      });
  }

  private updateAll = (modIds: string[]) => {
    const { gameMode } = this.props;
    const updateAble = modIds.filter(modId => {
      const mod = this.props.mods[modId];
      const state = updateState(mod.attributes);
      return state === 'update' && mod.type !== 'collection';
    });
    if (updateAble.length < modIds.length) {
      this.context.api.sendNotification({
        id: 'check-mods-version-partial',
        type: 'info',
        message: 'Some mods could not be updated automatically.',
      });
    }
    if (updateAble.length > 0) {
      this.context.api.events.emit('mods-update', gameMode, updateAble);
    }
  }
}

const emptyObject = {};

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    mods: getSafe(state, ['persistent', 'mods', gameMode], emptyObject),
    gameMode,
    updateRunning: getSafe(state, ['session', 'mods', 'updatingMods', gameMode], false),
    isPremium: getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps)(
      CheckVersionsButton)) as React.ComponentClass<IBaseProps>;
