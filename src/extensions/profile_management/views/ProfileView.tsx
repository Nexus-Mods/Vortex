import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import Icon from '../../../views/Icon';

import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { setFeature, setProfile } from '../actions/profiles';
import { setNextProfile } from '../actions/settings';
import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import ProfileEdit from './ProfileEdit';
import ProfileItem from './ProfileItem';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import update = require('react-addons-update');
import { generate as shortid } from 'shortid';

export interface IBaseProps {
  features: IProfileFeature[];
}

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
  onSetFeature: (profileId: string, featureId: string, value: any) => void;
}

interface IViewState {
  edit: string;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * presents profiles and allows creation of new ones
 * 
 * @class ProfileView
 */
class ProfileView extends ComponentEx<IProps, IViewState> {
  constructor(props) {
    super(props);

    this.state = {
      edit: null,
    };
  }

  public render(): JSX.Element {
    const { features, language, profiles } = this.props;
    const { edit } = this.state;

    const sortedProfiles: string[] = this.sortProfiles(profiles, language);

    const supportedFeatures = features.filter((feature) => feature.supported());

    return (
      <ListGroup style={{ overflowY: 'auto', height: '100%' }}>
      { sortedProfiles.map((profileId) => this.renderProfile(profileId, supportedFeatures)) }
      { this.renderAddOrEdit(edit) }
      </ListGroup>
    );
  }

  private sortProfiles(profiles: { [id: string]: IProfile }, language: string) {
    return Object.keys(profiles).sort(
      (lhs: string, rhs: string): number =>
        profiles[lhs].gameId !== profiles[rhs].gameId
          ? profiles[lhs].gameId.localeCompare(profiles[rhs].gameId)
          : profiles[lhs].name.localeCompare(profiles[rhs].name, language,
            { sensitivity: 'base' })
    );
  }

  private renderProfile = (profileId: string, features: IProfileFeature[]): JSX.Element => {
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
        features={ features }
        gameName={ game.name }
        active={ currentProfile === profileId }
        onClone={ this.onCloneProfile }
        onActivate={ onSetNextProfile }
        onStartEditing={ this.editExistingProfile }
      />
    );
  }

  private renderAddOrEdit(editId: string) {
    return editId === null
      ? this.renderAddProfile()
      : editId === '__new'
        ? this.renderEditProfile()
        : null;
  }

  private renderEditProfile(): JSX.Element {
    const { t, features, gameId, onSetFeature, profiles } = this.props;
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
        features={ features }
        profile={ profile }
        onSetFeature={ onSetFeature }
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
    onSetFeature: (profileId: string, featureId: string, value: any) =>
      dispatch(setFeature(profileId, featureId, value)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ProfileView
    )
  ) as React.ComponentClass<{}>;
