import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { ComponentEx } from '../../../util/ComponentEx';
import opn from '../../../util/opn';

import { IMod } from '../../mod_management/types/IMod';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { ListGroupItem, Media, Popover } from 'react-bootstrap';

export interface IProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
  getBounds: () => ClientRect;
  container: HTMLElement;
  onRefreshGameInfo: (gameId: string) => Promise<void>;
  onBrowseGameLocation: (gameId: string) => Promise<void>;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameRow extends ComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, container, discovery,
            game, getBounds, onRefreshGameInfo, type } = this.props;

    if (game === undefined) {
      return null;
    }

    const logoPath: string = path.join(game.extensionPath, game.logo);

    const location = (discovery !== undefined) && (discovery.path !== undefined)
      ? <a onClick={this.openLocation}>{discovery.path}</a>
      : <a onClick={this.changeLocation}>{t('Browse...')}</a>;

    const classes = [ 'game-list-item' ];
    if (active) {
      classes.push('game-list-selected');
    }

    const gameInfoPopover = (
      <Popover id={`popover-info-${game.id}`} className='popover-game-info' >
        <IconBar
          id={`game-thumbnail-${game.id}`}
          className='buttons'
          group={`game-${type}-buttons`}
          instanceId={game.id}
          staticElements={[]}
          collapse={false}
          buttonType='text'
          orientation='vertical'
          filter={this.lowPriorityButtons}
          t={t}
        />
        <GameInfoPopover
          t={t}
          game={game}
          onChange={this.redraw}
          onRefreshGameInfo={onRefreshGameInfo}
        />
      </Popover>
    );

    return (
      <ListGroupItem className={classes.join(' ')}>
        <Media>
          <Media.Left>
            <div className='game-thumbnail-container-list'>
              <img className='game-thumbnail-img-list' src={logoPath} />
            </div>
          </Media.Left>
          <Media.Body>
            <Media.Heading>{t(game.name)}</Media.Heading>
            <p>Location: {location}</p>
          </Media.Body>
          <Media.Right>
            <OverlayTrigger
              triggerRef={this.setRef}
              getBounds={getBounds}
              container={container}
              overlay={gameInfoPopover}
              orientation='horizontal'
              shouldUpdatePosition={true}
              trigger='click'
              rootClose={true}
            >
              <IconButton
                id={`btn-info-${game.id}`}
                icon='game-menu'
                className='btn-embed'
                tooltip={t('Show Details')}
              />
            </OverlayTrigger>
            <IconBar
              className='btngroup-game-list'
              group={`game-${type}-buttons`}
              instanceId={game.id}
              staticElements={[]}
              collapse={false}
              filter={this.priorityButtons}
              clickAnywhere={true}
              buttonType='icon'

              t={t}
            />
          </Media.Right>
        </Media>
      </ListGroupItem>
    );
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private redraw = () => {
    if (this.mRef !== null) {
      this.mRef.hide();
      setTimeout(() => {
        if (this.mRef !== null) {
          this.mRef.show();
        }
      }, 100);
    }
  }

  private openLocation = () => {
    const { discovery } = this.props;
    opn(discovery.path).catch(() => null);
  }

  private changeLocation = () => {
    this.props.onBrowseGameLocation(this.props.game.id);
  }

  private priorityButtons = (action: IActionDefinition) =>
    action.position < 100

  private lowPriorityButtons = (action: IActionDefinition) =>
    action.position >= 100
}

export default GameRow as React.ComponentClass<IProps>;
