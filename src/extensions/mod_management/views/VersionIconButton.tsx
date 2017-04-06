import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import { IVersionIcon } from '../../mod_management/types/IVersion';
import downloadMod from '../../nexus_integration/util/downloadMod';

import * as React from 'react';

export interface IBaseProps {
  versionIcon: IVersionIcon;
  nexusModId: number;
  newestFileId: string;
  gameMode: string;
  api: IExtensionApi;
}

export interface IVersionIconButtonState {
  showLayer: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * Changelogs Button
 * 
 * @class ChangelogsButton
 */
class VersionIconButton extends ComponentEx<IProps, IVersionIconButtonState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    let { nexusModId, newestFileId, versionIcon } = this.props;

    if (versionIcon !== undefined) {
      return (
        <IconButton
          className='btn-version-column'
          id={nexusModId.toString()}
          value={newestFileId}
          tooltip={versionIcon.tooltip}
          icon={versionIcon.icon}
          onClick={this.downloadSelectedMod}
        />
      );
    } else {
      return null;
    }
  }

  private downloadSelectedMod = (evt) => {
    let { api, gameMode } = this.props;
    let modId = evt.currentTarget.id;
    let newestFileId = evt.currentTarget.value;

    downloadMod(modId, newestFileId, gameMode, api);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(VersionIconButton)
  ) as React.ComponentClass<IBaseProps>;
