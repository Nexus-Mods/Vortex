import { IDiscoveryState, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameThumbnail from './GameThumbnail';

import Promise from 'bluebird';
import * as React from 'react';

export interface IBaseProps {
}

interface IConnectedProps {
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
}

interface IActionProps {
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  more: boolean;
}

class Dashlet extends ComponentEx<IProps, IComponentState> {
  private mRef: Element;
  private mInnerRef: Element;

  constructor(props: IProps) {
    super(props);

    this.initState({
      more: false,
    });
  }

  public componentDidMount() {
    this.refreshMore();
  }

  public render(): JSX.Element {
    const { t, discoveredGames, knownGames } = this.props;
    const { more } = this.state;

    const games: IGameStored[] = knownGames.filter(game =>
      getSafe(discoveredGames, [game.id, 'path'], undefined) !== undefined);

    return (
      <div>
        <h3 className='dashlet-game-title'>{t('Welcome to Vortex')}</h3>
        <span>{ t('As this is the first time you start Vortex, please pick a game to manage. ' +
                  'Afterwards please check the ToDo List below.') }</span>
        <div style={{ display: 'flex' }} ref={this.setRef}>
          <div style={{ overflowX: 'hidden', position: 'relative' }}>
            <div style={{ display: 'inline-flex' }} ref={this.setInnerRef}>
              {games.map(game => (
                <GameThumbnail
                  t={t}
                  key={game.id}
                  game={game}
                  type='discovered'
                  active={false}
                  onRefreshGameInfo={this.refreshGameInfo}
                />))
              }
            </div>
            {more ? (
              <div className='dashlet-game-more'>
                <a onClick={this.openGames}>{t('More...')}</a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  private openGames = () => {
    this.context.api.events.emit('show-main-page', 'Games');
  }

  private refreshMore = () => {
    if ((this.mRef === null) || (this.mInnerRef === null)) {
      return;
    }

    const more =
      this.mInnerRef.getBoundingClientRect().width > this.mRef.getBoundingClientRect().width;
    if (more !== this.state.more) {
      this.nextState.more = more;
    }
    setTimeout(this.refreshMore, 1000);
  }

  private refreshGameInfo = gameId => {
    return new Promise<void>((resolve, reject) => {
      this.context.api.events.emit('refresh-game-info', gameId, err => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private setRef = (ref: Element) => {
    this.mRef = ref;
  }

  private setInnerRef = (ref: Element) => {
    this.mInnerRef = ref;
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(Dashlet)) as React.ComponentClass<{}>;
