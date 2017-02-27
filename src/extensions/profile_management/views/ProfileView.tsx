import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { setProfile } from '../actions/profiles';
import { setNextProfile } from '../actions/settings';
import { IProfile } from '../types/IProfile';

import ProfileItem from './ProfileItem';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { FormControl, ListGroup, ListGroupItem } from 'react-bootstrap';
import update = require('react-addons-update');
import {generate as shortid} from 'shortid';

interface IConnectedProps {
  gameId: string;
  currentProfile: string;
  profiles: { [id: string]: IProfile };
  language: string;
  games: IGameStored[];
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onSetNextProfile: (profileId: string) => void;
}

interface IViewState {
  edit: string;
}

interface IEditState {
  edit: IProfile;
}

interface IEditProps {
  profileId: string;
  gameId: string;
  profile?: IProfile;
  onSaveEdit: (profile: IProfile) => void;
  onCancelEdit: () => void;
}

/**
 * list element displayed when editing an item
 * 
 * @class ProfileEdit
 */
class ProfileEdit extends ComponentEx<IEditProps, IEditState> {
  constructor(props: IEditProps) {
    super(props);
    this.state = props.profile !== undefined
      ? { edit: Object.assign({}, props.profile) }
      : { edit: {
          id: props.profileId,
          gameId: props.gameId,
          modState: {},
          name: '',
        } };
  }

  public render(): JSX.Element {
    const { t, profileId, onCancelEdit } = this.props;
    const { edit } = this.state;
    const inputControl = (
      <FormControl
        autoFocus
        type='text'
        value={ edit.name }
        onChange={ this.changeEditName }
        onKeyPress={ this.handleKeypress }
        style={{flexGrow: 1}}
      />
    );
    return (
      <ListGroupItem key={profileId} className='inline-form'>
        {inputControl}
        <Button id='__accept' tooltip={ t('Accept') } onClick={ this.saveEdit }>
          <Icon name='check' />
        </Button>
        <Button id='__cancel' tooltip={ t('Cancel') } onClick={ onCancelEdit }>
          <Icon name='times' />
        </Button>
      </ListGroupItem>
    );
  }

  private handleKeypress = (evt: React.KeyboardEvent<any>) => {
    if (evt.which === 13) {
      evt.preventDefault();
      this.saveEdit();
    }
  }

  private saveEdit = () => {
    this.props.onSaveEdit(this.state.edit);
  };

  private changeEditName = (evt) => {
    this.setState(update(this.state, {
      edit: {
        name: { $set: evt.target.value },
      },
    }));
  };
}

/**
 * presents profiles and allows creation of new ones
 * 
 * @class ProfileView
 */
class ProfileView extends ComponentEx<IConnectedProps & IActionProps, IViewState> {
  constructor(props) {
    super(props);

    this.state = {
      edit: null,
    };
  }

  public render(): JSX.Element {
    const { language, profiles } = this.props;
    const { edit } = this.state;

    const sortedProfiles: string[] = Object.keys(profiles).sort(
      (lhs: string, rhs: string): number =>
        profiles[lhs].gameId !== profiles[rhs].gameId
          ? profiles[lhs].gameId.localeCompare(profiles[rhs].gameId)
          : profiles[lhs].name.localeCompare(profiles[rhs].name, language,
          { sensitivity: 'base' })
    );

    return (
      <ListGroup>
      { sortedProfiles.map(this.renderProfile) }
      { edit === null ? this.renderAddProfile() : null }
      { edit === '__new' ? this.renderEditProfile() : null }
      </ListGroup>
    );
  }

  private renderProfile = (profileId: string): JSX.Element => {
    const { edit } = this.state;
    if (profileId === edit) {
      return this.renderEditProfile();
    }

    const { currentProfile, games, onSetNextProfile, profiles } = this.props;

    let game = games.find((iter: IGameStored) => iter.id === profiles[profileId].gameId);

    return (profileId === this.state.edit) ? null : (
      <ProfileItem
        key={ profileId }
        profile={ profiles[profileId] }
        gameName={ game.name }
        active={ currentProfile === profileId }
        onClone={ this.onCloneProfile }
        onActivate={ onSetNextProfile }
        onStartEditing={ this.editExistingProfile }
      />
    );
  }

  private renderEditProfile(): JSX.Element {
    const { t, gameId, profiles } = this.props;
    const { edit } = this.state;
    let profile = undefined;
    if (edit !== '__new') {
      profile = profiles[edit];
    }
    return (
      <ProfileEdit
        profileId={ edit }
        gameId={ gameId }
        t={ t }
        profile={ profile }
        onSaveEdit={ this.saveEdit }
        onCancelEdit={ this.endEdit }
      />
    );
  }

  private renderAddProfile() {
    const { t } = this.props;
    return (
      <ListGroupItem
        key='__add'
        header={<Icon name='plus' />}
        onClick={ this.editNewProfile }
      >
        { t('Add Profile') }
      </ListGroupItem>
    );
  }

  private saveEdit = (profile: IProfile) => {
    const { onAddProfile } = this.props;
    if (profile.id === '__new') {
      let newId: string = shortid();
      let newProf: IProfile = update(profile, { id: { $set: newId } });
      onAddProfile(newProf);
    } else {
      onAddProfile(profile);
    }
    this.endEdit();
  };

  private endEdit = () => {
    this.setState(update(this.state, {
      edit: { $set: null },
    }));
  };

  private editNewProfile = () => {
    this.setState(update(this.state, {
      edit: { $set: '__new' },
    }));
  };

  private onCloneProfile = (profileId: string) => {
    const { onAddProfile, profiles } = this.props;
    let newProfile = Object.assign({}, profiles[profileId]);
    newProfile.id = shortid();
    fs.copyAsync(profilePath(profiles[profileId]), profilePath(newProfile))
    .then(() => {
      onAddProfile(newProfile);
      this.editExistingProfile(newProfile.id);
    });
  }

  private editExistingProfile = (profileId: string) => {
    this.setState(update(this.state, {
      edit: { $set: profileId },
    }));
  }
}

function profilePath(profile: IProfile): string {
  return path.join(remote.app.getPath('userData'), profile.gameId, 'profiles', profile.id);
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    gameId,
    currentProfile: state.settings.profiles.activeProfileId,
    profiles: state.persistent.profiles,
    language: state.settings.interface.language,
    games: state.session.gameMode.known,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddProfile: (profile: IProfile) => dispatch(setProfile(profile)),
    onSetNextProfile: (profileId: string) => dispatch(setNextProfile(profileId)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ProfileView
    )
  ) as React.ComponentClass<{}>;
