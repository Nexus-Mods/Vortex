import { ComponentEx, translate } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { IGameStored } from '../types/IStateEx';

import * as path from 'path';
import * as React from 'react';
import { Panel } from 'react-bootstrap';

export interface IProps {
  game: IGameStored;
  hidden: boolean;
  onManage?: (id: string) => void;
  onHide: (id: string, hidden: boolean) => void;
  active: boolean;
}

/**
 * thumbnail + controls for a single game mode within the game picker
 * 
 * @class GameThumbnail
 */
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
          { this.renderHideButton() }
        </div>
      </Panel>
    );
  }

  private renderManageButton() {
    const { t, active, game } = this.props;
    let buttonId = `manage-${game.id}`;

    if (this.clickHandler === undefined || active) {
      return null;
    }

    return (
      <Button
        id={buttonId}
        tooltip={t('Manage')}
        onClick={this.clickHandler}
      >
        <Icon name='asterisk' />
      </Button>
    );
  }

  private toggleHidden = () => {
    const { game, hidden, onHide } = this.props;
    onHide(game.id, !hidden);
  }

  private renderHideButton() {
    const { t, hidden, game } = this.props;
    return (
      <Button
        id={`showhide-${game.id}`}
        tooltip={ hidden ? t('Show') : t('Hide') }
        onClick={ this.toggleHidden }
      >
        { hidden ? <Icon name='eye' /> : <Icon name='eye-slash' /> }
      </Button>
    );
  }
}

export default
  translate(['common'], { wait: false })(GameThumbnail) as React.ComponentClass<IProps>;
