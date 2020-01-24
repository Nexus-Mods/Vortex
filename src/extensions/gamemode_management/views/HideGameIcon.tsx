import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';

import { setGameHidden } from '../actions/settings';

import * as React from 'react';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  instanceId: string;
  buttonType: ButtonType;
}

interface IConnectedProps {
  gamesDiscovered: { [gameId: string]: IDiscoveryResult };
}

interface IActionProps {
  onSetGameHidden: (gameId: string, hidden: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class HideGameIcon extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { buttonType, instanceId, gamesDiscovered } = this.props;
    const t = this.context.api.translate;
    const hidden = getSafe(gamesDiscovered, [instanceId, 'hidden'], false);
    const icon = hidden ? 'show' : 'hide';
    const text = hidden ? t('Show') : t('Hide');
    return (
      <ToolbarIcon
        id={`hide-${instanceId}`}
        icon={(['icon', 'both'].indexOf(buttonType) !== -1) ? icon : undefined}
        text={(['text', 'both'].indexOf(buttonType) !== -1) ? text : undefined}
        onClick={this.toggleHidden}
      />
    );
  }
  private toggleHidden = () => {
    const { instanceId, gamesDiscovered, onSetGameHidden } = this.props;
    const hidden = getSafe(gamesDiscovered, [instanceId, 'hidden'], false);
    onSetGameHidden(instanceId, !hidden);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gamesDiscovered: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetGameHidden: (gameId: string, hidden: boolean) => dispatch(setGameHidden(gameId, hidden)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(HideGameIcon);
