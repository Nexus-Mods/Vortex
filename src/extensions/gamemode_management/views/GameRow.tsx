import { DialogType, IDialogActions, IDialogContent } from '../../../actions/notifications';
import { ComponentEx } from '../../../util/ComponentEx';
import Advanced from '../../../views/Advanced';
import IconBar from '../../../views/IconBar';

import { IMod } from '../../mod_management/types/IMod';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { ListGroupItem, Media } from 'react-bootstrap';

export interface IProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
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
  public render(): JSX.Element {
    const { t, active, discovery, game, type } = this.props;

    const logoPath: string = path.join(game.extensionPath, game.logo);

    const location = (discovery !== undefined) && (discovery.path !== undefined)
      ? (
        <Advanced>
          <a onClick={this.openLocation}>{discovery.path}</a>
          {discovery.path}
        </Advanced>
      ) : <a onClick={this.openLocation}>{t('Browse...')}</a>;

    const classes = [ 'game-list-ite' ];
    if (active) {
      classes.push('game-list-selected');
    }

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
