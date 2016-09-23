import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';

import * as path from 'path';
import * as React from 'react';
import { Jumbotron, Media } from 'react-bootstrap';
import { connect } from 'react-redux';
import Icon = require('react-fontawesome');

interface IConnectedProps {
  gameMode: string;
  knownGames: IGame[];
}

class WelcomeScreen extends React.Component<IConnectedProps, {}> {
  public render(): JSX.Element {
    let { gameMode } = this.props;
    return (
      <Jumbotron className='full-height'>
        Welcome to Nexus Mod Manager 2!
        { gameMode === undefined ? <div>No game selected</div> : this.renderGameMode() }
      </Jumbotron>
    );
  }

  private renderGameMode = () => {
    let { gameMode, knownGames } = this.props;

    let game: IGame = knownGames.find((ele) => ele.id === gameMode);

    let logoPath: string;
    if (game !== undefined) {
      logoPath = path.join(game.pluginPath, game.logo);
    }

    return (
      <Media>
        <Media.Left>
          { game === undefined ? <Icon name='spinner' spin /> : <img className='welcome-game-logo' src={logoPath} />}
        </Media.Left>
        <Media.Right>
          <Media.Heading>
            { game === undefined ? gameMode : game.name }
          </Media.Heading>
        </Media.Right>
      </Media>
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: state.settings.base.gameMode,
    knownGames: state.session.knownGames,
  };
}

export default connect(mapStateToProps)(WelcomeScreen);
