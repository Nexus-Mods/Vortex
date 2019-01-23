import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/api';
import { IProfile, IState } from '../../../types/IState';
import { connect, PureComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { countIf } from '../../../util/util';

import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel, Popover } from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  active: boolean;
  onRefreshGameInfo?: (gameId: string) => Promise<void>;
  type: string;
  getBounds?: () => ClientRect;
  container?: HTMLElement;
  onLaunch?: () => void;
}

interface IConnectedProps {
  profile: IProfile;
}

type IProps = IBaseProps & IConnectedProps;

function nop() {}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends PureComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, game, profile, type } = this.props;

    if (game === undefined) {
      return null;
    }

    const logoPath: string = path.join(game.extensionPath, game.logo);

    // Mod count should only be shown for Managed and Discovered games as
    //  the supported type suggests that the game has been removed from the machine.
    const modCount = ((profile !== undefined) && (type !== 'undiscovered'))
      ? countIf(Object.keys(profile.modState || {}), id => profile.modState[id].enabled)
      : undefined;

    return (
      <Panel className='game-thumbnail' bsStyle={active ? 'primary' : 'default'}>
        <Panel.Body className='game-thumbnail-body'>
          <img
            className={'thumbnail-img'}
            src={logoPath}
          />
          <div className='bottom'>
            <div className='name'>{t(game.name)}</div>
            {
              modCount !== undefined
                ? <div className='active-mods'>
                    <Icon name='mods' />
                    <span>{t('{{ count }} active mod', { count: modCount })}</span>
                  </div>
                : null
            }
          </div>
          <div className='hover-menu'>
            {type === 'launcher' ? this.renderLaunch() : this.renderMenu()}
          </div>
          {type !== 'launcher' ? (
          <div className='game-thumbnail-tags'>
            {game.contributed ? (
              <IconButton className='btn-embed' icon='contributor' tooltip={t('Contributed by {{name}}', { replace: { name: game.contributed } })}/>
             ) : (
              <IconButton className='btn-embed' icon='official' tooltip={t('Officially Supported')} />
             )}
            {game.final ? null : (
              <a className='fake-link' onClick={nop} title={t('Not fully tested, please provide feedback')}>{t('Beta')}</a>
              
            )}
          </div>
          ) : null}
        </Panel.Body>
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
          <Icon name='launch-application'/>
        </Button>
      </div>
    );
  }

  private renderMenu(): JSX.Element[] {
    const { t, container, game, getBounds, onRefreshGameInfo, type } = this.props;
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
          onRefreshGameInfo={onRefreshGameInfo}
          onChange={this.redraw}
        />
      </Popover>
    );

    return [(
      <div key='primary-buttons' className='hover-content'>
        <IconBar
          id={`game-thumbnail-${game.id}`}
          className='buttons'
          group={`game-${type}-buttons`}
          instanceId={game.id}
          staticElements={[]}
          collapse={false}
          buttonType='text'
          orientation='vertical'
          filter={this.priorityButtons}
          clickAnywhere={true}
          t={t}
        />
      </div>
    ), (
      <OverlayTrigger
        key='info-overlay'
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
          icon='game-menu'
          className='game-thumbnail-info btn-embed'
          tooltip={t('Show Details')}
        />
      </OverlayTrigger>
    )];
  }

  private priorityButtons = (action: IActionDefinition) =>
    action.position < 100

  private lowPriorityButtons = (action: IActionDefinition) =>
    action.position >= 100

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
      setTimeout(() => {
        if (this.mRef !== null) {
          this.mRef.show();
        }
      }, 100);
    }
  }
}

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const profiles = state.persistent.profiles;
  const lastActiveProfile =
    getSafe(state.settings.profiles, ['lastActiveProfile', ownProps.game.id], undefined);
  return {
    profile: lastActiveProfile !== undefined ? profiles[lastActiveProfile] : undefined,
  };
}

export default
  connect(mapStateToProps)(
    GameThumbnail) as React.ComponentClass<IBaseProps>;
