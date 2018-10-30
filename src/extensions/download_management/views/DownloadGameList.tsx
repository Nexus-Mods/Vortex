import FlexLayout from '../../../controls/FlexLayout';
import { IconButton } from '../../../controls/TooltipControls';
import { IGameStored, IState } from '../../../types/IState';
import { connect, PureComponentEx } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import * as selectors from '../../../util/selectors';

import { setCompatibleGames } from '../actions/state';

import * as Promise from 'bluebird';
import * as fuzz from 'fuzzball';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { DropdownButton, ListGroup, ListGroupItem, MenuItem } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  t: I18next.TranslationFunction;
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
    return (
      <ListGroupItem key={gameId} className={idx === 0 ? 'primary-game' : undefined}>
        {selectors.gameName(this.context.api.store.getState(), gameId)}
        <IconButton icon='remove' tooltip={t('Remove')} className='btn-embed' data-gameid={gameId} onClick={this.removeGame} />
      </ListGroupItem>
    );
  }

  private addGame = (gameId: any) => {
    const { currentGames, onSetCompatibleGames } = this.props;
    onSetCompatibleGames([].concat(currentGames, [gameId]));
  }

  private moveDownload(gameId: string) {
    const { currentGames, fileName } = this.props;
    // removing the main game, have to move the download then
    const state = this.context.api.store.getState();
    const oldPath = selectors.downloadPathForGame(state, currentGames[0]);
    const newPath = selectors.downloadPathForGame(state, gameId);
    return fs.moveAsync(path.join(oldPath, fileName), path.join(newPath, fileName))
      .tap(() => {
        this.context.api.sendNotification({
          type: 'success',
          title: 'Download moved',
          message: fileName,
        });
      })
      .catch(err => this.context.api.showErrorNotification('Unable to move archive', err, { allowReport: ['EPERM','ENOSPC','EEXIST'].indexOf(err.code) === -1 }));
  }

  private removeGame = (evt: React.MouseEvent<any>) => {
    const { currentGames, onSetCompatibleGames } = this.props;
    const gameId = evt.currentTarget.getAttribute('data-gameid');
    const idx = currentGames.indexOf(gameId);
    if ((idx !== -1) && (currentGames.length > 1)) {
      const prom = (idx === 0)
        ? this.moveDownload(currentGames[1])
        : Promise.resolve();
      prom.then(() => {
        let newGames = [].concat(currentGames);
        newGames.splice(idx, 1);
        onSetCompatibleGames(newGames);
      });
    }
  }
}

function mapStateToProps(): {} {
  return {};
}

function mapDispatchToProps(dispatch: ThunkDispatch<IState, null, Redux.Action>, ownProps: IBaseProps): IActionProps {
  return {
    onSetCompatibleGames: (games: string[]) => dispatch(setCompatibleGames(ownProps.id, games)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadGameList);
