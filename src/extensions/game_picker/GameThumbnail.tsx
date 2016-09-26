import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';

import { IGame } from '../../types/IGame';

import { ComponentEx, translate } from '../../util/ComponentEx';

import * as path from 'path';

interface IProps {
  game: IGame;
  onManage?: (id: string) => void;
  active: boolean;
}

class GameThumbnail extends ComponentEx<IProps, {}> {
  private clickHandler: () => void;

  constructor(props) {
    super(props);
    if (props.onManage !== undefined) {
      this.clickHandler = () => this.props.onManage(this.props.game.id);
    }
  }

  public render(): JSX.Element {
    let { t, game, active } = this.props;

    const logoPath: string = path.join(game.pluginPath, game.logo);

    return (
      <Panel bsClass='game-thumbnail' bsStyle={active ? 'primary' : 'default'}>
        <div style={{ position: 'relative', top: '0px' }}>
        <img className='game-thumbnail-img' src={ logoPath } />
        </div>
        <div className='game-thumbnail-bottom'>
          <h3>{ t(game.name) }</h3>
          { this.renderManageButton() }
        </div>
      </Panel>
    );
  }

  private renderManageButton = () => {
    const { t, active } = this.props;
    return (this.clickHandler !== undefined && !active)
      ? <Button onClick={ this.clickHandler }>{ t('Manage') }</Button>
      : null;
  }
}

export default translate(['common'], { wait: true })(GameThumbnail) as React.ComponentClass<IProps>;
