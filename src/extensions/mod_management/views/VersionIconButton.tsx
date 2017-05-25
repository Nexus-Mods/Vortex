import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { IconButton } from '../../../views/TooltipControls';

import { IModWithState } from '../types/IModProps';
import { UpdateState } from '../util/modUpdateState';

import * as path from 'path';
import * as React from 'react';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  gameMode: string;
  mod: IModWithState;
  state: UpdateState;
  downloads: {};
  mods: {};
  downloadPath: string;
}

type IProps = IBaseProps;

/**
 * VersionIcon Button
 *
 * @class VersionIconButton
 */
class VersionIconButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { mod, state } = this.props;

    const tooltip = this.getStateTooltip(state);
    const icon = this.getStateIcon(state);

    if (icon === undefined) {
      return null;
    }

    return (
      <IconButton
        className='btn-version-column'
        id={`btn-version-${mod.id}`}
        tooltip={tooltip}
        icon={icon}
        onClick={this.downloadSelectedMod}
      />
    );
  }

  private getStateTooltip(state) {
    const { t, mod } = this.props;

    const newVersion = getSafe(mod.attributes, ['newestVersion'], '?');

    switch (state) {
      case 'bug-update':
        return t('Mod should be updated because the installed version is bugged');
      case 'bug-disable':
        return t('Mod should be disabled or downgraded because this version has been '
          + 'marked as "bugged" by the author');
      case 'update': return t('Mod can be updated (Current version: {{newVersion}})', {
        replace: { newVersion },
      });
      case 'update-site':
        return t('Mod can be updated (but you will have to pick the file yourself)');
      case 'install':
        return t('The newest file is already downloaded.');
      default: return undefined;
    }
  }

  private getStateIcon(state) {
    switch (state) {
      case 'bug-update': return 'bug';
      case 'bug-disable': return 'ban';
      case 'update': return 'cloud-download';
      case 'update-site': return 'external-link';
      case 'install': return 'check';
      default: return undefined;
    }
  }

  private downloadSelectedMod = () => {
    const { downloads, downloadPath, gameMode, mod, mods, state } = this.props;
    const newestFileId = getSafe(mod.attributes, ['newestFileId'], undefined);
    const newestFileName = getSafe(mod.attributes, ['newestFileName'], undefined);

    if ((state === 'update') || (state === 'bug-update')) {
      this.context.api.events.emit('download-mod-update',
        gameMode, mod.attributes['modId'], newestFileId);
    } else if ((state === 'update-site') || (state === 'bug-update-site')) {
      this.context.api.events.emit('open-mod-page',
        gameMode, mod.attributes['modId']);
    } else if (state === 'install') {
      const newModId = Object.keys(downloads).find((key) => {
        if (downloads[key].localPath === newestFileName) {
          return Object.keys(mods).find((modKey) =>
            mods[modKey].attributes['fileName'] === newestFileName) !== undefined;
        }
      });

      if (newModId !== undefined) {
        this.context.api.events.emit('start-install-download', newModId);
      } else {
        const newFileName: string = path.join(downloadPath, newestFileName);
        this.context.api.events.emit('start-install', newFileName);
      }
    }
  }
}

export default VersionIconButton as React.ComponentClass<IBaseProps>;
