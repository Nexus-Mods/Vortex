import { ComponentEx, translate } from '../../../util/ComponentEx';
import IconBar from '../../../views/IconBar';
import { IGameStored } from '../types/IGameStored';

import * as path from 'path';
import * as React from 'react';
import { Panel } from 'react-bootstrap';

export interface IProps {
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
    let { t, game, active, type } = this.props;

    const logoPath: string = path.join(game.pluginPath, game.logo);

    return (
      <Panel bsClass='game-thumbnail' bsStyle={active ? 'primary' : 'default'}>
        <div style={{ position: 'relative', top: '0px' }}>
        <img className='game-thumbnail-img' src={ logoPath } />
        </div>
        <div className='game-thumbnail-bottom'>
          <h3>{ t(game.name) }</h3>
          <IconBar
            group={`game-${type}-buttons`}
            instanceId={game.id}
            staticElements={[]}
          />
        </div>
      </Panel>
    );
  }
}

export default
  translate(['common'], { wait: false })(GameThumbnail) as React.ComponentClass<IProps>;
