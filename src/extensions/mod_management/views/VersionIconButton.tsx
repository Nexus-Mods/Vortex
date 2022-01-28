import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { IDownload } from '../../download_management/types/IDownload';

import { IModWithState } from '../types/IModProps';
import { isIdValid, UpdateState } from '../util/modUpdateState';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  t: TFunction;
  gameMode: string;
  mod: IModWithState;
  state: UpdateState;
  downloads: { [archiveId: string]: IDownload };
  mods: { [modId: string]: any };
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

    const valid = isIdValid(mod);
    const tooltip = this.getStateTooltip(state, valid);
    const icon = this.getStateIcon(state, valid);

    if (icon === undefined) {
      return null;
    }

    return (
      <IconButton
        className='btn-embed'
        id={`btn-version-${mod.id}`}
        tooltip={tooltip}
        icon={icon}
        onClick={this.trigger}
      />
    );
  }

  private getStateTooltip(state: UpdateState, valid: boolean) {
    const { t, mod } = this.props;

    if (!valid) {
      if (mod.attributes?.source === undefined) {
        return t('This mod has no source assigned. The source tells Vortex where the mod '
                + 'came from and, if applicable, where to check for updates. '
                + 'You can set the source to "Other" to disable this warning.');
      } else {
        return t('This mod is missing identification information. Without this some '
                + 'features like checking for updates or adding this mod to collections '
                + 'will not work.');
      }
    }

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

  private getStateIcon(state: UpdateState, valid: boolean) {
    if (!valid) {
      return 'feedback-warning';
    }

    switch (state) {
      case 'bug-update': return 'bug';
      case 'bug-disable': return 'ban';
      case 'update': return 'auto-update';
      case 'update-site': return 'open-in-browser';
      default: return undefined;
    }
  }

  private trigger = () => {
    const { gameMode, mod, state } = this.props;
    const newestFileId = getSafe(mod.attributes, ['newestFileId'], undefined);
    const downloadGame = getSafe(mod.attributes, ['downloadGame'], gameMode);
    const newestVersion = getSafe(mod.attributes, ['newestVersion'], undefined);

    if ((state === 'update') || (state === 'bug-update')) {
      if (mod.attributes?.collectionId !== undefined) {
        this.context.api.events.emit('collection-update',
          downloadGame, mod.attributes?.collectionSlug, newestVersion,
          mod.attributes?.source, mod.id);
      } else {
        this.context.api.events.emit('mod-update',
          downloadGame, mod.attributes?.modId, newestFileId, mod.attributes?.source);
      }
    } else if ((state === 'update-site') || (state === 'bug-update-site')) {
      if (mod.attributes?.collectionId !== undefined) {
        this.context.api.events.emit('open-collection-page',
          downloadGame, mod.attributes?.collectionSlug, mod.attributes?.source);
      } else {
        this.context.api.events.emit('open-mod-page',
          downloadGame, mod.attributes?.modId, mod.attributes?.source);
      }
    }
  }
}

export default VersionIconButton as React.ComponentClass<IBaseProps>;
