import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';

import { setGameHidden } from '../actions/settings';

import * as React from 'react';
import * as Redux from 'redux';

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
    return (
      <ToolbarIcon
        id={`hide-${instanceId}`}
        icon={hidden ? 'eye' : 'eye-slash'}
        text={hidden ? t('Show') : t('Hide')}
        onClick={this.toggleHidden}
        buttonType={buttonType}
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

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetGameHidden: (gameId: string, hidden: boolean) => dispatch(setGameHidden(gameId, hidden)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  HideGameIcon) as React.ComponentClass<IBaseProps>;
