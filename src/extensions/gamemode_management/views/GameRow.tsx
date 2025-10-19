import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { PureComponentEx } from '../../../util/ComponentEx';
import opn from '../../../util/opn';
import { isMacOS } from '../../../util/platform';

import { IMod } from '../../mod_management/types/IMod';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

// TODO: Remove Bluebird import - using native Promise;
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { ListGroupItem, Media, Popover } from 'react-bootstrap';
import { Provider } from 'react-redux';
import { pathToFileURL } from 'url';

export interface IProps {
  t: TFunction;
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
  getBounds: () => ClientRect;
  container: HTMLElement;
  onRefreshGameInfo: (gameId: string) => Promise<void>;
  onBrowseGameLocation: (gameId: string) => Promise<void>;
  style?: React.CSSProperties; // For virtualization
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameRow extends PureComponentEx<IProps, Record<string, never>> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, container, discovery,
      game, getBounds, onRefreshGameInfo, type, style } = this.props;

    if (game === undefined) {
      return null;
    }

    const logoPath: string = ((game.extensionPath !== undefined)
                           && (game.logo !== undefined))
      ? path.join(game.extensionPath, game.logo)
      : game.imageURL;

    let imgurl = null;
    if (logoPath !== null && logoPath !== undefined && logoPath !== '') {
      try {
        const protocol = new URL(logoPath).protocol;
        imgurl = ((protocol !== null) && (protocol.startsWith('http')))
          ? logoPath
          : pathToFileURL(logoPath).href;
      } catch (error) {
        // Invalid URL, fall back to null
        imgurl = null;
      }
    }

    const location = (discovery !== undefined) && (discovery.path !== undefined)
      ? <a onClick={this.openLocation}>{discovery.path}</a>
      : null;

    const classes = [ 'game-list-item' ];
    if (active) {
      classes.push('game-list-selected');
    }
    if (discovery === undefined) {
      classes.push('game-list-undiscovered');
    }

    // Check if the game has macOS compatibility data
    const hasMacOSCompatibility = isMacOS() && game.details?.macOSCompatibility !== undefined;
    
    // Add macOS compatibility indicator to classes
    if (hasMacOSCompatibility) {
      classes.push('game-list-macos-compatible');
    }

    const gameInfoPopover = (
      <Popover id={`popover-info-${game.id}`} className='popover-game-info' >
        <Provider store={this.context.api.store}>
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
        </Provider>
      </Popover>
    );

    return (
      <div style={style}>
        <ListGroupItem className={classes.join(' ')}>
          <Media>
            <Media.Left>
              <div className='game-thumbnail-container-list'>
                <img 
                  className='game-thumbnail-img-list' 
                  src={imgurl || ''} 
                  onError={this.handleImageError}
                />
                {hasMacOSCompatibility && (
                  <div className='game-macos-indicator' title={t('macOS Compatible')}>
                    <span className='macos-icon'>🍎</span>
                  </div>
                )}
              </div>
            </Media.Left>
            <Media.Body>
              <Media.Heading>
                {t((game.name || '').replace(/\t/g, ' '))}
                {hasMacOSCompatibility && (
                  <span className='game-macos-badge' title={t('macOS Compatible')}>
                    {t('Mac')}
                  </span>
                )}
              </Media.Heading>
              {(location !== null) ? (<p>{t('Location')}: {location}</p>) : null}
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
                t={t}
                className='btngroup-game-list'
                group={`game-${type}-buttons`}
                instanceId={game.id}
                staticElements={[]}
                collapse={false}
                filter={this.priorityButtons}
                clickAnywhere={true}
                buttonType='icon'
                showAll
              />
            </Media.Right>
          </Media>
        </ListGroupItem>
      </div>
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

  private handleImageError = (evt: React.SyntheticEvent<any>) => {
    evt.currentTarget.style.display = 'none';
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