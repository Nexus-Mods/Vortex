import { DialogType, IDialogActions, IDialogContent } from '../../../actions/notifications';
import { ComponentEx } from '../../../util/ComponentEx';
import Advanced from '../../../views/Advanced';
import IconBar from '../../../views/IconBar';
import OverlayTrigger from '../../../views/OverlayTrigger';
import { IconButton } from '../../../views/TooltipControls';

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
  onSetGamePath: (gameId: string, gamePath: string, modsPath: string) => void;
  onSetGameDiscovery: (gameId: string, result: IDiscoveryResult) => void;
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: IDialogActions) => void;
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
      <ListGroupItem className={ classes.join(' ') }>
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

  private verifyGamePath(game: IGameStored, gamePath: string): Promise<void> {
    return Promise.map(game.requiredFiles, file =>
      fs.statAsync(path.join(gamePath, file)))
    .then(() => undefined);
  }

  private openLocation = () => {
    const { discovery, game, onSetGameDiscovery, onSetGamePath,
            onShowDialog, t } = this.props;
    if (discovery !== undefined) {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
        defaultPath: discovery.path,
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          this.verifyGamePath(game, fileNames[0])
            .then(() => {
              let modPath = game.modPath;
              if (!path.isAbsolute(modPath)) {
                modPath = path.resolve(fileNames[0], modPath);
              }
              onSetGamePath(game.id, fileNames[0], modPath);
            })
            .catch(() => {
              onShowDialog('error', 'Game not found', {
                message: t('This directory doesn\'t appear to contain the game. '
                  + 'Expected to find these files: {{ files }}',
                  { replace: { files: game.requiredFiles.join(', ') } }),
              }, {
                  Cancel: null,
                  'Try Again': this.openLocation,
              });
            });
        }
      });
    } else {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          this.verifyGamePath(game, fileNames[0])
            .then(() => {
              let modPath = game.modPath;
              if (!path.isAbsolute(modPath)) {
                modPath = path.resolve(fileNames[0], modPath);
              }
              onSetGameDiscovery(game.id, {
                path: fileNames[0],
                modPath,
                tools: {},
                hidden: false,
                environment: game.environment,
              });
            })
            .catch(() => {
              onShowDialog('error', 'Game not found', {
                message: t('This directory doesn\'t appear to contain the game. '
                  + 'Expected to find these files: {{ files }}',
                  { replace: { files: game.requiredFiles.join(', ') } }),
              }, {
                  Cancel: null,
                  'Try Again': this.openLocation,
                });
            });
        }
      });
    }
  }
}

export default GameRow as React.ComponentClass<IProps>;
