import { SITE_GAME_NAME } from '../../../controls/constants';
import FlexLayout from '../../../controls/FlexLayout';
import { IconButton } from '../../../controls/TooltipControls';
import { IGameStored, IState } from '../../../types/IState';
import { connect, PureComponentEx } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import * as selectors from '../../../util/selectors';
import { truthy } from '../../../util/util';

import { SITE_ID } from '../../gamemode_management/constants';

import { setCompatibleGames } from '../actions/state';

import Promise from 'bluebird';
import * as fuzz from 'fuzzball';
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { DropdownButton, ListGroup, ListGroupItem, MenuItem } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  t: TFunction;
  id: string;
  currentGames: string[];
  games: IGameStored[];
  fileName: string;
}

interface IActionProps {
  onSetCompatibleGames: (games: string[]) => void;
}

type IProps = IBaseProps & IActionProps;

class DownloadGameList extends PureComponentEx<IProps, {}> {
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
    const { t } = this.props;
    const gameName = gameId === SITE_ID
      ? t(SITE_GAME_NAME)
      : selectors.gameName(this.context.api.store.getState(), gameId);
    return (
      <ListGroupItem key={gameId} className={idx === 0 ? 'primary-game' : undefined}>
        {gameName}
        <IconButton
          icon='remove'
          tooltip={t('Remove')}
          className='btn-embed'
          data-gameid={gameId}
          onClick={this.removeGame}
        />
      </ListGroupItem>
    );
  }

  private addGame = (gameId: any) => {
    const { currentGames, onSetCompatibleGames, fileName } = this.props;
    const validGameEntries = currentGames.filter(game => !!game);
    if ((validGameEntries.length === 0)
     || (currentGames[0] !== validGameEntries[0])) {
      return this.moveDownload(gameId)
        .tap(() =>
          this.context.api.sendNotification({
            type: 'success',
            title: 'Download moved',
            message: fileName,
        }))
        .then(() => onSetCompatibleGames([].concat(validGameEntries, [gameId])));
    } else {
      onSetCompatibleGames([].concat(validGameEntries, [gameId]));
    }
  }

  private moveDownload(gameId: string): Promise<void> {
    const { currentGames, fileName } = this.props;
    if (fileName === undefined) {
      log('warn', 'Failed to move download, filename is undefined', { gameId });
      return Promise.resolve();
    }
    // removing the main game, have to move the download then
    const state = this.context.api.store.getState();
    const oldPath = truthy(currentGames[0])
      ? selectors.downloadPathForGame(state, currentGames[0])
      : selectors.downloadPath(state);
    const newPath = selectors.downloadPathForGame(state, gameId);
    const source = path.join(oldPath, fileName);
    const dest = path.join(newPath, fileName);
    return fs.moveAsync(source, dest)
      .catch(err => {
        if (err.code !== 'EEXIST') {
          return Promise.reject(err);
        } else {
          // We can use the "modified time" to assert whether we're dealing with
          //  identical files and remove the source if this is the case - if not - raise error.
          return Promise.all([fs.statAsync(source), fs.statAsync(dest)]).then(res =>
            res[0].mtimeMs === res[1].mtimeMs
              ? fs.removeAsync(source)
              : Promise.reject(err));
        }
      });
  }

  private removeGame = (evt: React.MouseEvent<any>) => {
    const { currentGames, onSetCompatibleGames, fileName } = this.props;
    const gameId = evt.currentTarget.getAttribute('data-gameid');
    const idx = currentGames.indexOf(gameId);
    if ((idx !== -1) && (currentGames.length > 1)) {
      const prom = (idx === 0)
        ? this.moveDownload(currentGames[1]).tap(() => {
            this.context.api.sendNotification({
              type: 'success',
              title: 'Download moved',
              message: fileName,
            });

            return Promise.resolve();
        })
        : Promise.resolve();
      prom.then(() => {
        const newGames = [].concat(currentGames);
        newGames.splice(idx, 1);
        onSetCompatibleGames(newGames);
      })
      .catch(err => this.context.api.showErrorNotification(
        `Unable to remove game ${gameId}`,
        err,
        { allowReport: ['EPERM', 'ENOSPC', 'EEXIST'].indexOf(err.code) === -1 }));
    }
  }
}

function mapStateToProps(): {} {
  return {};
}

function mapDispatchToProps(dispatch: ThunkDispatch<IState, null, Redux.Action>,
                            ownProps: IBaseProps): IActionProps {
  return {
    onSetCompatibleGames: (games: string[]) => dispatch(setCompatibleGames(ownProps.id, games)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadGameList);
