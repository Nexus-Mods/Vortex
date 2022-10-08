import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import { IGameInfoEntry, IState } from '../../../types/IState';
import { ComponentEx, connect } from '../../../util/ComponentEx';
import opn from '../../../util/opn';
import { bytesToString } from '../../../util/util';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import Bluebird from 'bluebird';
import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  t: TFunction;
  game: IGameStored;
  onRefreshGameInfo: (gameId: string) => Bluebird<void>;
  onChange: () => void;
}

interface IConnectedProps {
  discoveredGames: { [id: string]: IDiscoveryResult };
  gameInfo: {
    [key: string]: IGameInfoEntry,
  };
  language: string;
}

type IProps = IBaseProps & IConnectedProps;

class GameInfoPopover extends ComponentEx<IProps, { loading: boolean }> {
  private mMounted: boolean = false;
  constructor(props: IProps) {
    super(props);
    this.state = { loading: false };
  }

  public componentDidMount() {
    const { game, onRefreshGameInfo } = this.props;
    this.mMounted = true;
    if (onRefreshGameInfo !== undefined) {
      this.setState({ loading: true });
      onRefreshGameInfo(game.id)
        .then(() => {
          if (this.mMounted) {
            this.setState({ loading: false });
          }
        });
    }
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if ((this.props.discoveredGames !== nextProps.discoveredGames)
      && (nextProps.onRefreshGameInfo !== undefined)) {
      // A change in discovered games would suggest that the player has
      //  modified the game's path - We need to refresh the game information
      //  object.
      nextProps.onRefreshGameInfo(nextProps.game.id);
    }

    if (this.props.gameInfo !== nextProps.gameInfo) {
      nextProps.onChange();
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const gameInfo: { [key: string]: IGameInfoEntry } = this.props.gameInfo || {};

    const keysToRender = Object.keys(gameInfo)
      .sort((lhs, rhs) => (gameInfo[lhs].priority ?? 100) - (gameInfo[rhs].priority ?? 100))
      .filter(key => gameInfo[key].value !== null);

    if (keysToRender.length === 0) {
      return (
        <EmptyPlaceholder icon='layout-list' text={t('No Information about this game')} />
      );
    }

    return (
      <div className='game-info-grid'>
        {keysToRender.map(this.renderGameInfo)}
      </div>
    );
  }

  private renderGameInfo = (key: string) => {
    const { t, gameInfo } = this.props;
    return [
      <div key={`${key}-title`} className='game-info-title'>{t(gameInfo[key].title)}</div>,
      (
        <div key={`${key}-value`} className='game-info-value'>
          {this.renderValue(gameInfo[key].value, gameInfo[key].type || 'string')}
        </div>
      ),
    ];
  }

  private renderValue = (value: any, type: string) => {
    const { language } = this.props;
    if (type === 'date') {
      return new Date(value).toLocaleString(language);
    } else if (type === 'url') {
      return <a onClick={this.openUrl} href={value} >{value}</a>;
    } else if (type === 'bytes') {
      return bytesToString(value);
    } else {
      return value;
    }
  }

  private openUrl = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    opn(evt.currentTarget.href).catch(err => undefined);
  }
}

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  return {
    discoveredGames: state.settings.gameMode.discovered,
    gameInfo: state.persistent.gameMode.gameInfo?.[ownProps.game.id],
    language: state.settings.interface.language,
  };
}

export default connect(mapStateToProps)(GameInfoPopover);
