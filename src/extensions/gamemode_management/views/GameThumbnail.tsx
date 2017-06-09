import { ComponentEx } from '../../../util/ComponentEx';
import IconBar from '../../../views/IconBar';
import { IGameStored } from '../types/IGameStored';

import * as path from 'path';
import * as React from 'react';
import { Panel } from 'react-bootstrap';

export interface IProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  active: boolean;
  type: string;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, active, game, type } = this.props;

    const logoPath: string = path.join(game.extensionPath, game.logo);

    return (
      <Panel bsClass='game-thumbnail' bsStyle={active ? 'primary' : 'default'}>
        <img
          className={ 'thumbnail-img' }
          src={ logoPath }
        />
        <div className='bottom'>
          <h5 className='name'>{ t(game.name) }</h5>
          <p className='flex-fill'/>
          <IconBar
            id={`game-thumbnail-${game.id}`}
            className='buttons'
            group={`game-${type}-buttons`}
            instanceId={game.id}
            staticElements={[]}
            collapse={true}
          />
        </div>
      </Panel>
    );
  }
}

export default GameThumbnail as React.ComponentClass<IProps>;
