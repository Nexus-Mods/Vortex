import { DialogActions, DialogType, IDialogContent, IDialogResult,
         showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { removeProfile, setFeature, setProfile } from '../actions/profiles';
import { setNextProfile } from '../actions/settings';
import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import ProfileEdit from './ProfileEdit';
import ProfileItem from './ProfileItem';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
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
  discoveredGames: { [gameId: string]: IDiscoveryResult };
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onRemoveProfile: (profileId: string) => void;
  onSetNextProfile: (profileId: string) => void;
  onSetFeature: (profileId: string, featureId: string, value: any) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => void;
}

interface IViewState {
  edit: string;
  highlightGameId: string;
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
      highlightGameId: undefined,
    };
  }

  public render(): JSX.Element {
    const { t, discoveredGames, features, gameId, games, language, profiles } = this.props;
    const { edit } = this.state;

    const currentGameProfiles: { [id: string]: IProfile } = {};
    const otherProfiles: { [id: string]: IProfile } = {};

    Object.keys(profiles).forEach(profileId => {
      if (profiles[profileId].gameId === gameId) {
        currentGameProfiles[profileId] = profiles[profileId];
      } else {
        otherProfiles[profileId] = profiles[profileId];
      }
    });

    const currentGameProfilesSorted = this.sortProfiles(currentGameProfiles, language);
    const otherProfilesSorted = this.sortProfiles(otherProfiles, language);

    // const sortedProfiles: string[] = this.sortProfiles(profiles, language);

    const supportedFeatures = features.filter(feature => feature.supported());

    const game = games.find((iter: IGameStored) => iter.id === gameId);
    const discovered = discoveredGames[gameId];
    const gameName = getSafe(discovered, ['name'], getSafe(game, ['name'], ''));

    return (
      <MainPage>
        <MainPage.Body>
          {gameName}
          <ListGroup className='profile-list'>
            {currentGameProfilesSorted.map(
              profileId => this.renderProfile(profileId, supportedFeatures))}
            {this.renderAddOrEdit(edit)}
          </ListGroup>
          {t('Other Games')}
          <ListGroup className='profile-list'>
            {otherProfilesSorted.map(
              profileId => this.renderProfile(profileId, supportedFeatures))}
          </ListGroup>
        </MainPage.Body>
      </MainPage>
    );
  }

  private sortProfiles(profiles: { [id: string]: IProfile }, language: string) {
    return Object.keys(profiles).sort(
      (lhs: string, rhs: string): number =>
        profiles[lhs].gameId !== profiles[rhs].gameId
          ? profiles[lhs].gameId.localeCompare(profiles[rhs].gameId)
          : profiles[lhs].name.localeCompare(profiles[rhs].name, language,
            { sensitivity: 'base' }));
  }

  private renderProfile = (profileId: string, features: IProfileFeature[]): JSX.Element => {
    const { t } = this.props;
    const { edit } = this.state;
    if (profileId === edit) {
      return this.renderEditProfile();
    }

    const { currentProfile, discoveredGames, games, onSetNextProfile, profiles } = this.props;

    const game = games.find((iter: IGameStored) => iter.id === profiles[profileId].gameId);
    const discovered = discoveredGames[profiles[profileId].gameId];
    const gameName = getSafe(discovered, ['name'], getSafe(game, ['name'], ''));
    const available = (discovered !== undefined) && (discovered.path !== undefined);

    return (profileId === this.state.edit) ? null : (
      <ProfileItem
        t={t}
        key={profileId}
        profile={profiles[profileId]}
        features={features}
        gameName={gameName}
        active={currentProfile === profileId}
        available={available}
        onClone={this.onCloneProfile}
        onRemove={this.onRemoveProfile}
        onActivate={onSetNextProfile}
        onStartEditing={this.editExistingProfile}
        highlightGameId={this.state.highlightGameId}
        onSetHighlightGameId={this.setHighlightGameId}
      />
    );
  }

  private setHighlightGameId = (gameId: string) => {
    this.setState(update(this.state, {
      highlightGameId: { $set: gameId },
    }));
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
    let profile;
    if (edit !== '__new') {
      profile = profiles[edit];
    }

    return (
      <ProfileEdit
        key={edit}
        profileId={edit}
        gameId={gameId}
        t={t}
        features={features}
        profile={profile}
        onSetFeature={onSetFeature}
        onSaveEdit={this.saveEdit}
        onCancelEdit={this.endEdit}
      />
    );
  }

  private renderAddProfile() {
    const { t } = this.props;

    const { discoveredGames, gameId, games } = this.props;

    if (gameId === undefined) {
      return null;
    }

    const game = games.find((iter: IGameStored) => iter.id === gameId);
    const discovered = discoveredGames[gameId];
    const gameName = getSafe(discovered, ['name'], getSafe(game, ['name'], ''));

    return (
      <ListGroupItem
        key='__add'
        header={<Icon name='plus' />}
        onClick={this.editNewProfile}
      >
        {t('Add "{{ name }}" Profile', { replace: { name: gameName } })}
      </ListGroupItem>
    );
  }

  private saveEdit = (profile: IProfile) => {
    const { onAddProfile } = this.props;
    if (profile.id === '__new') {
      const newId: string = shortid();
      const newProf: IProfile = update(profile, { id: { $set: newId } });
      onAddProfile(newProf);
    } else {
      onAddProfile(profile);
    }
    this.endEdit();
  }

  private endEdit = () => {
    this.setState(update(this.state, {
      edit: { $set: null },
    }));
  }

  private editNewProfile = () => {
    this.setState(update(this.state, {
      edit: { $set: '__new' },
    }));
  }

  private onCloneProfile = (profileId: string) => {
    const { onAddProfile, profiles } = this.props;
    const newProfile = { ...profiles[profileId] };
    newProfile.id = shortid();
    fs.copyAsync(profilePath(profiles[profileId]), profilePath(newProfile))
    .then(() => {
      onAddProfile(newProfile);
      this.editExistingProfile(newProfile.id);
    });
  }

  private onRemoveProfile = (profileId: string) => {
    const { onRemoveProfile, onShowDialog, profiles } = this.props;
    onShowDialog('question', 'Confirm', {
      message: 'Remove this profile? This can\'t be undone!',
    }, [
        { label: 'Cancel', default: true },
        {
          label: 'Remove', action: () => fs.removeAsync(profilePath(profiles[profileId]))
            .then(() => onRemoveProfile(profileId)),
        },
    ]);
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
    discoveredGames: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddProfile: (profile: IProfile) => dispatch(setProfile(profile)),
    onRemoveProfile: (profileId: string) => dispatch(removeProfile(profileId)),
    onSetNextProfile: (profileId: string) => dispatch(setNextProfile(profileId)),
    onSetFeature: (profileId: string, featureId: string, value: any) =>
      dispatch(setFeature(profileId, featureId, value)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ProfileView)) as React.ComponentClass<{}>;
