import { ComponentEx, translate } from '../../../util/ComponentEx';
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
  game: IGameStored;
  discovery?: IDiscoveryResult;
  mods?: { [modId: string]: IMod };
  active: boolean;
  type: string;
  onSetGamePath: (gameId: string, gamePath: string, modsPath: string) => void;
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

    const location = discovery !== undefined
              ? <Advanced>
                <a onClick={this.openLocation}>{discovery.path}</a>
                {discovery.path}
                </Advanced>
              : <a onClick={this.openLocation}>t('Browse...') }</a>;

    return (
      <ListGroupItem bsStyle={ active ? 'info' : undefined }>
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
            />
          </Media.Right>
        </Media>
      </ListGroupItem>
    );
  }

  private openLocation = () => {
    const { discovery, game, onSetGamePath } = this.props;
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
    }
  }
}

/*
    let className = active ? 'list-group-item active' : 'list-group-item';

    return (
      <span className={className}>
        <h4 className='list-group-item-heading'>{ `${gameName} - ${profile.name}` }</h4>
        <div className='list-group-item-text'>
          <ul className='profile-details'>

*/

export default
  translate(['common'], { wait: false })(GameRow) as React.ComponentClass<IProps>;
