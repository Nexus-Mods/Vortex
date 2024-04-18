import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import OverlayTrigger from '../../../controls/OverlayTrigger';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/api';
import { IMod, IProfile, IState } from '../../../types/IState';
import { connect, PureComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { countIf } from '../../../util/util';

import { IGameStored } from '../types/IGameStored';

import GameInfoPopover from './GameInfoPopover';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel, Popover } from 'react-bootstrap';
import { Provider } from 'react-redux';
import * as url from 'url';

export interface IBaseProps {
  t: TFunction;
  game: IGameStored;
  active: boolean;
  discovered?: boolean;
  onRefreshGameInfo?: (gameId: string) => Promise<void>;
  type: string;
  getBounds?: () => ClientRect;
  container?: HTMLElement;
  onLaunch?: () => void;
}

interface IConnectedProps {
  profile: IProfile;
  mods: { [modId: string]: IMod };
}

type IProps = IBaseProps & IConnectedProps;

function nop() {
  // nop
}

/**
 * thumbnail + controls for a single game mode within the game picker
 *
 * @class GameThumbnail
 */
class GameThumbnail extends PureComponentEx<IProps, {}> {
  private mRef = null;

  public render(): JSX.Element {
    const { t, active, discovered, game, mods, profile, type } = this.props;

    if (game === undefined) {
      return null;
    }

    const logoPath: string = ((game.extensionPath !== undefined)
                           && (game.logo !== undefined))
      ? path.join(game.extensionPath, game.logo)
      : game.imageURL;

    // Mod count should only be shown for Managed and Discovered games as
    //  the supported type suggests that the game has been removed from the machine.
    const modCount = ((profile !== undefined) && (type !== 'undiscovered'))
      ? countIf(Object.keys(profile.modState || {}),
          id => profile.modState[id].enabled && (mods[id] !== undefined))
      : undefined;

    const nameParts = game.name.split('\t');

    const classes = [
      'game-thumbnail',
      `game-thumbnail-${(discovered !== false) ? 'discovered' : 'undiscovered'}`,
    ];

    let imgurl = null;
    if (logoPath !== null) {
      const protocol = url.parse(logoPath).protocol;
      imgurl = ((protocol !== null) && (protocol.startsWith('http')))
        ? logoPath
        : url.pathToFileURL(logoPath).href;
    }

    return (
      <Panel className={classes.join(' ')} bsStyle={active ? 'primary' : 'default'}>
        <Panel.Body className='game-thumbnail-body'>
          <img
            className={'thumbnail-img'}
            src={imgurl}
          />
          <div className='bottom'>
            <div className='name'>
              {nameParts.map((part, idx) => (<div key={idx} className='name-part'>{t(part)}</div>))}
            </div>
            {
              modCount !== undefined
                ? (
                  <div className='active-mods'>
                    <Icon name='mods' />
                    <span>{t('{{ count }} active mod', { count: modCount })}</span>
                  </div>
                )
                : null
            }
          </div>
          <div className='hover-menu'>
            {type === 'launcher' ? this.renderLaunch() : this.renderMenu()}
          </div>
          {type !== 'launcher' ? (
            game.contributed ? (
              <div className='game-thumbnail-tags' title={game.contributed ? t('Contributed by {{name}}', { replace: { name: game.contributed } }) : null}>
              {game.contributed ? ('Community') : null}
            </div>
            ) : null 
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
      <Popover id={`popover-info-${game.id}`} className='popover-game-info'>
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
            onRefreshGameInfo={onRefreshGameInfo}
            onChange={this.redraw}
          />
        </Provider>
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

  private getWindowBounds = (): DOMRect => {
    return {
      top: 0,
      left: 0,
      height: window.innerHeight,
      width: window.innerWidth,
      bottom: window.innerHeight,
      right: window.innerWidth,
    } as any;
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private redraw = () => {
    if (this.mRef !== null) {
      this.mRef.forceUpdate();
    }
  }
}

const emptyObj = {};

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  const profiles = state.persistent.profiles;

  const lastActiveProfile = ownProps.game !== undefined
    ? getSafe(state.settings.profiles, ['lastActiveProfile', ownProps.game.id], undefined)
    : undefined;

  const profile = lastActiveProfile !== undefined ? profiles[lastActiveProfile] : undefined;

  return {
    profile,
    mods: ((profile !== undefined) ? state.persistent.mods[profile.gameId] : emptyObj) || emptyObj,
  };
}

export default
  connect(mapStateToProps)(GameThumbnail);
