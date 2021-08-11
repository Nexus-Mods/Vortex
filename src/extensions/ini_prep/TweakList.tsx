import { setDeploymentNecessary } from '../../actions';
import Spinner from '../../controls/Spinner';
import Toggle from '../../controls/Toggle';
import { IState } from '../../types/IState';
import { ComponentEx, connect, PureComponentEx, translate } from '../../util/ComponentEx';
import * as fs from '../../util/fs';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { setINITweakEnabled } from '../mod_management/actions/mods';
import { INI_TWEAKS_PATH } from '../mod_management/InstallManager';
import { installPath } from '../mod_management/selectors';
import { IMod } from '../mod_management/types/IMod';
import { activeGameId } from '../profile_management/selectors';

import Bluebird from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IBaseProps {
  modId: string;
  tweaks: string[];
}

interface IConnectedProps {
  gameMode: string;
  mod: IMod;
}

interface IActionProps {
  onSetINITweakEnabled: (gameId: string, modId: string, tweak: string, enabled: boolean) => void;
  onSetDeploymentNecessary: (gameId: string, required: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface ITweakProps {
  fileName: string;
  enabled: boolean;
  onToggle: (fileName: string, enabled: boolean) => void;
}

class Tweak extends PureComponentEx<ITweakProps, {}> {
  public render(): JSX.Element {
    const { enabled, fileName } = this.props;
    const match = fileName.match(/(.*)\[(.*)\]\.ini/);

    if (!truthy(match) || (match.length < 2)) {
      return null;
    }

    return (
      <ListGroupItem className='listitem-tweak'>
        <Toggle checked={enabled} onToggle={this.toggle}>{match[1]}</Toggle>
      </ListGroupItem>
      );
  }

  private toggle = (enabled: boolean) => {
    const { fileName, onToggle } = this.props;
    onToggle(fileName, enabled);
  }
}

class TweakList extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, tweaks } = this.props;

    if (tweaks.length === 0) {
      return null;
    }

    return (
      <div>
        <label className='control-label'>{t('Ini Tweaks')}</label>
        <ListGroup>
          {tweaks.map(this.renderTweak)}
        </ListGroup>
      </div>
    );
  }

  private renderTweak = (fileName: string): JSX.Element => {
    const { mod } = this.props;
    const isEnabled = (mod.enabledINITweaks ?? []).includes(fileName);
    return (
      <Tweak
        key={`tweak-${fileName}`}
        fileName={fileName}
        enabled={isEnabled}
        onToggle={this.toggle}
      />
      );
  }

  private toggle = (fileName: string, enabled: boolean) => {
    const { gameMode, mod, onSetDeploymentNecessary, onSetINITweakEnabled } = this.props;
    onSetINITweakEnabled(gameMode, mod.id, fileName, enabled);
    onSetDeploymentNecessary(gameMode, true);
  }
}

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const gameMode = activeGameId(state);
  return {
    gameMode,
    mod: state.persistent.mods[gameMode]?.[ownProps.modId],
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<IState, null, Redux.Action>): IActionProps {
  return {
    onSetINITweakEnabled:
    (gameId: string, modId: string, tweak: string, enabled: boolean) => {
      dispatch(setINITweakEnabled(gameId, modId, tweak, enabled));
    },
    onSetDeploymentNecessary: (gameId: string, required: boolean) => {
      dispatch(setDeploymentNecessary(gameId, required));
    },
  };
}

const TweakListConnected = translate(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    TweakList)) as React.ComponentClass<IBaseProps>;

interface ITweakListWrapProps {
  modId: string;
  getTweaks: (modsPath: string, mod: IMod) => Bluebird<string[]>;
}

function TweakListWrap(props: ITweakListWrapProps) {
  const { modId, getTweaks } = props;

  const [curTweaks, setCurTweaks] = React.useState<string[]>(null);

  const gameMode = useSelector<IState, string>(activeGameId);
  const modsPath = useSelector<IState, string>(installPath);
  const mod = useSelector<IState, IMod>(state => state.persistent.mods[gameMode]?.[modId]);

  React.useEffect(() => {
    getTweaks(modsPath, mod)
      .then(tweakList => {
        setCurTweaks(tweakList);
      });
  }, [modId, modsPath, getTweaks]);

  if (curTweaks === null) {
    return <Spinner />;
  } else {
    return <TweakListConnected modId={modId} tweaks={curTweaks} />;
  }
}

const renderINITweaks = (() => {
  const tweakLists: { [modId: string]: Bluebird<string[]> } = {};

  const getTweakList = (modsPath: string, mod: IMod) => {
    if (mod?.installationPath === undefined) {
      return Bluebird.resolve([]);
    }

    if ((tweakLists[mod.id] === undefined)
        && (mod?.installationPath !== undefined)) {
      const tweaksPath = path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
      tweakLists[mod.id] = fs.readdirAsync(tweaksPath)
        .catch(() => []);
    }

    return tweakLists[mod.id];
  };

  return (mod: IMod): JSX.Element => {
    return <TweakListWrap modId={mod.id} getTweaks={getTweakList} />;
  };
})();

export default renderINITweaks;
