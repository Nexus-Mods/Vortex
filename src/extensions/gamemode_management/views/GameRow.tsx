import { DialogActions, DialogType, IDialogContent } from '../../../actions/notifications';
import Advanced from '../../../controls/Advanced';
import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx } from '../../../util/ComponentEx';

import { IMod } from '../../mod_management/types/IMod';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
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
      ? (
        <Advanced>
          <a onClick={this.openLocation}>{discovery.path}</a>
          {discovery.path}
        </Advanced>
      ) : <a onClick={this.openLocation}>{t('Browse...')}</a>;

    const classes = [ 'game-list-item' ];
    if (active) {
      classes.push('game-list-selected');
    }

    const gameInfoPopover = (
      <Popover id={`popover-info-${game.id}`}>
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
                icon='alert-circle-i'
                className='btn-embed'
                tooltip={t('Show Details')}
              />
            </OverlayTrigger>
            <IconBar
              className='btngroup-game-list'
              group={`game-${type}-buttons`}
              instanceId={game.id}
              staticElements={[]}
              collapse={true}
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
      setTimeout(() => this.mRef.show(), 100);
    }
  }

  private openLocation = () => {
    this.props.onBrowseGameLocation(this.props.game.id);
  }
}

export default GameRow as React.ComponentClass<IProps>;
