import { ComponentEx } from '../../../util/ComponentEx';
import Advanced from '../../../views/Advanced';
import IconBar from '../../../views/IconBar';

import { IMod } from '../../mod_management/types/IMod';

import { IDiscoveryResult } from '../types/IDiscoveryResult';
import { IGameStored } from '../types/IGameStored';

import { remote } from 'electron';
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
}

/**
 * thumbnail + controls for a single game mode within the game picker
 * 
 * @class GameThumbnail
 */
class GameRow extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let { t, active, discovery, game, type } = this.props;

    const logoPath: string = path.join(game.extensionPath, game.logo);

    const location = (discovery !== undefined) && (discovery.path !== undefined)
              ? <Advanced>
                <a onClick={this.openLocation}>{discovery.path}</a>
                {discovery.path}
                </Advanced>
              : <a onClick={this.openLocation}>{t('Browse...') }</a>;

    let classes = [ 'game-list-item' ];
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

  private openLocation = () => {
    const { discovery, game, onSetGameDiscovery, onSetGamePath } = this.props;
    if (discovery !== undefined) {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
        defaultPath: discovery.path,
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          let modPath = game.modPath;
          if (!path.isAbsolute(modPath)) {
            modPath = path.resolve(fileNames[0], modPath);
          }
          onSetGamePath(game.id, fileNames[0], modPath);
        }
      });
    } else {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
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
        }
      });
    }
  }
}

export default GameRow as React.ComponentClass<IProps>;
