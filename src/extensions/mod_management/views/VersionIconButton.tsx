import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { IconButton } from '../../../views/TooltipControls';

import { IModWithState } from '../types/IModProps';
import { UpdateState } from '../util/modUpdateState';

import * as React from 'react';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  gameMode: string;
  mod: IModWithState;
  state: UpdateState;
}

type IProps = IBaseProps;

/**
 * VersionIcon Button
 * 
 * @class VersionIconButton
 */
class VersionIconButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { mod } = this.props;

    const versionIcon = this.getVersionIcon();

    if (versionIcon === undefined) {
      return null;
    }

    return (
      <IconButton
        className='btn-version-column'
        id={`btn-version-${mod.id}`}
        tooltip={versionIcon.tooltip}
        icon={versionIcon.icon}
        onClick={this.downloadSelectedMod}
      />
    );
  }

  private getVersionIcon = () => {
    const { t, state } = this.props;

    if (state === 'bug-update') {
      return {
          icon: 'bug',
          tooltip: t('Mod should be updated because the installed version is bugged'),
          classname: 'mod-updating-bug',
        };
    } else if (state === 'bug-disable') {
      // no update but this version is still marked as bugged
      return {
        icon: 'ban',
        tooltip: t('Mod should be disabled or downgraded because this version has been '
          + 'marked as "bugged" by the author'),
        classname: 'mod-updating-ban',
      };
    } else if (state === 'update') {
      return {
        icon: 'cloud-download',
        tooltip: t('Mod can be updated'),
        classname: 'mod-updating-download',
      };
    } else if (state === 'update-site') {
      return {
        icon: 'external-link',
        tooltip: t('Mod can be updated (but you will have to pick the file yourself)'),
        classname: 'mod-updating-warning',
      };
    } else {
      return undefined;
    }
  }

  private downloadSelectedMod = () => {
    const { gameMode, mod, state } = this.props;
    const newestFileId = getSafe(mod.attributes, ['newestFileId'], undefined);

    if ((state === 'update') || (state === 'bug-update')) {
      this.context.api.events.emit('download-mod-update',
        gameMode, (mod.attributes as any).modId, newestFileId);
    } else if ((state === 'update-site') || (state === 'bug-update-site')) {
      this.context.api.events.emit('open-mod-page',
        gameMode, (mod.attributes as any).modId);
    }
  }
}

export default VersionIconButton as React.ComponentClass<IBaseProps>;
