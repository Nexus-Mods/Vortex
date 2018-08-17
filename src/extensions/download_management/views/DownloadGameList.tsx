import FlexLayout from '../../../controls/FlexLayout';
import { IGameStored, IState } from '../../../types/IState';
import { connect, PureComponentEx } from '../../../util/ComponentEx';
import { gameName } from '../../../util/selectors';

import { setCompatibleGames } from '../actions/state';

import * as fuzz from 'fuzzball';
import * as I18next from 'i18next';
import * as React from 'react';
import { DropdownButton, ListGroup, ListGroupItem, MenuItem } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  id: string;
  currentGames: string[];
  games: IGameStored[];
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
        {gameName(this.context.api.store.getState(), game.id)}
      </MenuItem>
    );
  }

  private renderSelectedGame = (gameId: string, idx: number) => {
    return (
      <ListGroupItem key={gameId} className={idx === 0 ? 'primary-game' : undefined}>
        {gameName(this.context.api.store.getState(), gameId)}
      </ListGroupItem>
    );
  }

  private addGame = (gameId: any) => {
    const { currentGames, onSetCompatibleGames } = this.props;
    onSetCompatibleGames([].concat(currentGames, [gameId]));
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
