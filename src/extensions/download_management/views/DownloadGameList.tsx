import { SITE_GAME_NAME } from '../../../controls/constants';
import FlexLayout from '../../../controls/FlexLayout';
import { IconButton } from '../../../controls/TooltipControls';
import { IGameStored } from '../../../types/IState';
import { PureComponentEx } from '../../../util/ComponentEx';
import * as selectors from '../../../util/selectors';

import { SITE_ID } from '../../gamemode_management/constants';

import Promise from 'bluebird';
import * as fuzz from 'fuzzball';
import { TFunction } from 'i18next';
import * as React from 'react';
import { DropdownButton, ListGroup, ListGroupItem, MenuItem } from 'react-bootstrap';

export interface IDownloadGameListProps {
  t: TFunction;
  id: string;
  currentGames: string[];
  games: IGameStored[];
  onSetDownloadGames: (dlId: string, gameIds: string[]) => Promise<void>;
}

class DownloadGameList extends PureComponentEx<IDownloadGameListProps, {}> {
  public render(): JSX.Element {
    const { currentGames, t, games } = this.props;
    const notSelectedGames = games
      .filter(game => currentGames.indexOf(game.id) === -1)
      .sort((lhs, rhs) =>
        fuzz.ratio(currentGames[0], rhs.name) - fuzz.ratio(currentGames[0], lhs.name));

    return (
      <FlexLayout type='column'>
        <FlexLayout.Fixed className='game-list-container'>
          <DropdownButton
            id='game-list-add-button'
            title={t('Add')}
            onSelect={this.addGame}
          >
            {notSelectedGames.map(this.renderGame)}
          </DropdownButton>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed>
          <ListGroup className='archive-game-list'>
            {currentGames.map(this.renderSelectedGame)}
          </ListGroup>
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private renderGame = (game: IGameStored) => {
    return (
      <MenuItem key={game.id} eventKey={game.id}>
        {selectors.gameName(this.context.api.store.getState(), game.id)}
      </MenuItem>
    );
  }

  private renderSelectedGame = (gameId: string, idx: number) => {
    const { t, currentGames } = this.props;
    const gameName = gameId === SITE_ID
      ? t(SITE_GAME_NAME)
      : selectors.gameName(this.context.api.store.getState(), gameId);
    return (
      <ListGroupItem key={gameId} className={idx === 0 ? 'primary-game' : undefined}>
        {gameName || gameId}
        <IconButton
          icon='remove'
          tooltip={t('Remove')}
          className='btn-embed'
          data-gameid={gameId}
          disabled={currentGames.length < 2}
          onClick={this.removeGame}
        />
      </ListGroupItem>
    );
  }

  private addGame = (gameId: any) => {
    const { currentGames, id, onSetDownloadGames } = this.props;
    const validGameEntries = currentGames.filter(game => !!game);
    onSetDownloadGames(id, [].concat(validGameEntries, [gameId]));
  }

  private removeGame = (evt: React.MouseEvent<any>) => {
    const { currentGames, id, onSetDownloadGames } = this.props;
    const gameId = evt.currentTarget.getAttribute('data-gameid');

    const idx = currentGames.indexOf(gameId);
    const newGames = currentGames.slice(0);
    newGames.splice(idx, 1);
    if (newGames.length > 0) {
      onSetDownloadGames(id, newGames);
    }
  }
}

export default DownloadGameList;
