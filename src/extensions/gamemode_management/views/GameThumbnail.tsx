import { ComponentEx } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import { IconButton } from '../../../views/TooltipControls';

import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { OverlayTrigger, Panel, Popover } from 'react-bootstrap';

export interface IProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  active: boolean;
  onRefreshGameInfo: (gameId: string) => Promise<void>;
  type: string;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, active, game, onRefreshGameInfo, type } = this.props;

    const logoPath: string = path.join(game.extensionPath, game.logo);

    const gameInfoPopover = (
      <Popover id={`popover-info-${game.id}`} className='popover-game-info' >
        <GameInfoPopover t={t} game={game} onRefreshGameInfo={onRefreshGameInfo} />
      </Popover>
    );

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
        <OverlayTrigger
          overlay={gameInfoPopover}
          trigger='click'
          placement='bottom'
          rootClose={true}
        >
          <IconButton
            id={`btn-info-${game.id}`}
            icon='alert-circle-i'
            className='game-thumbnail-info btn-embed'
            tooltip={t('Show Details')}
            stroke
          />
        </OverlayTrigger>
      </Panel>
    );
  }
}

export default GameThumbnail as React.ComponentClass<IProps>;
