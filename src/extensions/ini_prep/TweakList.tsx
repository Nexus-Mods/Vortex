import { IState } from '../../types/IState';
import { ComponentEx, connect, PureComponentEx } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';
import Toggle from '../../views/OnOffToggle';

import { setINITweakEnabled } from '../mod_management/actions/mods';
import { INI_TWEAKS_PATH } from '../mod_management/InstallManager';
import { installPath } from '../mod_management/selectors';
import { IMod } from '../mod_management/types/IMod';
import { activeGameId } from '../profile_management/selectors';

import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';

interface IBaseProps {
  modId: string;
}

interface IConnectedProps {
  gameMode: string;
  modsPath: string;
  mod: IMod;
}

interface IActionProps {
  onSetINITweakEnabled: (gameId: string, modId: string, tweak: string, enabled: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  tweaks: string[];
}

interface ITweakProps {
  fileName: string;
  enabled: boolean;
  onToggle: (fileName: string, enabled: boolean) => void;
}

class Tweak extends PureComponentEx<ITweakProps, {}> {
  public render(): JSX.Element {
    const { enabled, fileName, onToggle } = this.props;
    const match = fileName.match(/(.*)\[(.*)\]\.ini/);

    if (!truthy(match) || (match.length < 2)) {
      return null;
    }

    return (
      <ListGroupItem className='listitem-tweak'>
        <Toggle value={enabled} onToggle={this.toggle} /> {match[1]}
      </ListGroupItem>);
  }

  private toggle = (enabled: boolean) => {
    const { fileName, onToggle } = this.props;
    onToggle(fileName, enabled);
  }
}

class TweakList extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      tweaks: [],
    });
  }

  public componentWillMount() {
    const { mod, modsPath } = this.props;

    if (mod !== undefined) {
      fs.readdirAsync(path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH))
        .then((files: string[]) => {
          this.nextState.tweaks = files;
        })
        .catch(() => undefined);
    }
  }

  public render(): JSX.Element {
    const { tweaks } = this.state;
    return (
      <ListGroup>
        {tweaks.map(this.renderTweak)}
      </ListGroup>);
  }

  private renderTweak = (fileName: string): JSX.Element => {
    const { mod } = this.props;
    const isEnabled = getSafe(mod, ['enabledINITweaks'], []).indexOf(fileName) !== -1;
    return (
      <Tweak
        key={`tweak-${fileName}`}
        fileName={fileName} enabled={isEnabled} onToggle={this.toggle}
      />);
  }

  private toggle = (fileName: string, enabled: boolean) => {
    const { gameMode, mod, onSetINITweakEnabled } = this.props;
    onSetINITweakEnabled(gameMode, mod.id, fileName, enabled);
  }
}

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    modsPath: installPath(state),
    mod: getSafe(state, ['persistent', 'mods', gameMode, ownProps.modId], undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<IState>): IActionProps {
  return {
    onSetINITweakEnabled:
    (gameId: string, modId: string, tweak: string, enabled: boolean) => {
      dispatch(setINITweakEnabled(gameId, modId, tweak, enabled));
    },
  };
}

const TweakListConnected = connect(mapStateToProps, mapDispatchToProps)(
  TweakList) as React.ComponentClass<IBaseProps>;

function renderINITweaks(mod: IMod): JSX.Element {
  return <TweakListConnected modId={mod.id}/>;
}

export default renderINITweaks;
