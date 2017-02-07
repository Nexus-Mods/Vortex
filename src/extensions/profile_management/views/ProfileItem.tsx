import { ComponentEx, translate } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import { Button, Icon as TooltipIcon } from '../../../views/TooltipControls';

import { IProfile } from '../types/IProfile';

import * as React from 'react';

export interface IProps {
  active: boolean;
  profile: IProfile;
  gameName: string;

  onActivate: (profileId: string) => void;
  onStartEditing: (id: string) => void;
}

/**
 * presents profiles and allows creation of new ones
 * 
 * @class ProfileView
 * @extends {React.Component<IConnectedProps, {}>}
 */
class ProfileItem extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, active, gameName, profile } = this.props;

    const enabledMods = Object.keys(profile.modState).reduce(
      (prev: number, key: string): number => {
        return profile.modState[key].enabled ? prev + 1 : prev;
    }, 0);

    // TODO: not using ListGroupItem because it puts the content into
    //       <p>-tags so it doesn't support 'complex' content

    let className = active ? 'list-group-item active' : 'list-group-item';

    return (
      <span className={className}>
        <h4 className='list-group-item-heading'>{ `${gameName} - ${profile.name}` }</h4>
        <div className='list-group-item-text'>
          <TooltipIcon
            id={profile.id}
            name='cubes'
            tooltip={ t('Number of Mods enabled') }
          />{ enabledMods }
          <div className='pull-right'>
            <Button
              className='btn-embed'
              id='__select'
              disabled={ active }
              tooltip={ t('Enable') }
              onClick={ this.activate }
            >
              <Icon name='play' />
            </Button>
            <Button
              className='btn-embed'
              id='__edit'
              tooltip={ t('Edit') }
              onClick={ this.startEditing }
            >
              <Icon name='wrench' />
            </Button>
            <Button
              className='btn-embed'
              id='__remove'
              tooltip={ t('Remove') }
            >
              <Icon name='remove' />
            </Button>
          </div>
        </div>
      </span>
    );
  }

  private activate = () => {
    const { onActivate, profile } = this.props;
    onActivate(profile.id);
  }

  private startEditing = () => {
    const { onStartEditing, profile } = this.props;
    onStartEditing(profile.id);
  }
}

export default
  translate(['common'], { wait: false })(
    ProfileItem
  ) as React.ComponentClass<IProps>;
