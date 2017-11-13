import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { PureComponentEx } from '../../../util/ComponentEx';

import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel, Popover } from 'react-bootstrap';

export interface IProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  active: boolean;
  onRefreshGameInfo?: (gameId: string) => Promise<void>;
  type: string;
  getBounds?: () => ClientRect;
  container?: HTMLElement;
  onLaunch?: () => void;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends PureComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, container, game, getBounds, onRefreshGameInfo, type } = this.props;

    if (game === undefined) {
      return null;
    }

    const logoPath: string = path.join(game.extensionPath, game.logo);

    return (
      <Panel bsClass='game-thumbnail' bsStyle={active ? 'primary' : 'default'}>
        <img
          className={'thumbnail-img'}
          src={logoPath}
        />
        <div className='bottom'>
          <h4 className='name'>{t(game.name)}</h4>
        </div>
        <div className='hover-menu'>
          {type === 'launcher' ? this.renderLaunch() : this.renderMenu()}
        </div>
      </Panel>
    );
  }

  private renderLaunch(): JSX.Element {
    const { onLaunch } = this.props;
    return (
      <div className='hover-content hover-launcher'>
        <Button
          style={{ width: '100%', height: '100%' }}
          onClick={onLaunch}
          className='btn-embed'
        >
          <Icon name='circle-play'/>
        </Button>
      </div>
    );
  }

  private renderMenu(): JSX.Element {
    const { t, container, game, getBounds, onRefreshGameInfo, type } = this.props;
    const gameInfoPopover = (
      <Popover id={`popover-info-${game.id}`} className='popover-game-info' >
        <GameInfoPopover
          t={t}
          game={game}
          onRefreshGameInfo={onRefreshGameInfo}
          onChange={this.redraw}
        />
      </Popover>
    );

    return (
      <div className='hover-content'>
        <IconBar
          id={`game-thumbnail-${game.id}`}
          className='buttons'
          group={`game-${type}-buttons`}
          instanceId={game.id}
          staticElements={[]}
          collapse={false}
          buttonType='menu'
          orientation='vertical'
        />
        <OverlayTrigger
          overlay={gameInfoPopover}
          triggerRef={this.setRef}
          getBounds={getBounds || this.getWindowBounds}
          container={container}
          orientation='horizontal'
          shouldUpdatePosition={true}
          trigger='click'
          rootClose={true}
        >
          <IconButton
            id={`btn-info-${game.id}`}
            icon='alert-circle-i'
            className='game-thumbnail-info btn-embed'
            tooltip={t('Show Details')}
          />
        </OverlayTrigger>
      </div>
    );
  }

  private getWindowBounds = (): ClientRect => {
    return {
      top: 0,
      left: 0,
      height: window.innerHeight,
      width: window.innerWidth,
      bottom: window.innerHeight,
      right: window.innerWidth,
    };
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
}

export default GameThumbnail as React.ComponentClass<IProps>;
