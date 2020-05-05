import { DialogActions, DialogType, IDialogContent, IDialogResult,
         showDialog } from '../../../actions/notifications';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { activeGameId } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';
import { getVortexPath } from '../../../util/api';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { removeProfile, setFeature, setProfile, willRemoveProfile } from '../actions/profiles';
import { setNextProfile } from '../actions/settings';
import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import ProfileEdit from './ProfileEdit';
import ProfileItem from './ProfileItem';

import update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Button, Collapse } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
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
  activity: string[];
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onRemoveProfile: (profileId: string) => void;
  onWillRemoveProfile: (profileId: string) => void;
  onSetNextProfile: (profileId: string) => void;
  onSetFeature: (profileId: string, featureId: string, value: any) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => void;
}

interface IViewState {
  edit: string;
  highlightGameId: string;
  showOther: boolean;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

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
      showOther: true,
    };
  }

  public render(): JSX.Element {
    const { t, activity, features, gameId, language, profiles } = this.props;
    const { edit, showOther } = this.state;

    const currentGameProfiles: { [id: string]: IProfile } = {};
    const otherProfiles: { [id: string]: IProfile } = {};

    Object.keys(profiles).forEach(profileId => {
      if ((profiles[profileId].gameId === undefined)
          || (profiles[profileId].name === undefined)) {
        return;
      }

      if (profiles[profileId].gameId === gameId) {
        currentGameProfiles[profileId] = profiles[profileId];
      } else {
        otherProfiles[profileId] = profiles[profileId];
      }
    });

    const currentGameProfilesSorted = this.sortProfiles(currentGameProfiles, language);
    const otherProfilesSorted = this.sortProfiles(otherProfiles, language);

    const isDeploying = activity.indexOf('deployment') !== -1;

    // const sortedProfiles: string[] = this.sortProfiles(profiles, language);

    const supportedFeatures = features.filter(feature => feature.supported());

    return (
      <MainPage>
        <MainPage.Body style={{ overflowY: 'auto' }}>
          <div className='profile-list'>
            {currentGameProfilesSorted.map(
              profileId => this.renderProfile(profileId, supportedFeatures))}
          </div>
          {this.renderAddOrEdit(edit)}
          <div>
            {t('Other Games')}
            {' '}
            <a onClick={this.toggleOther}>{showOther ? t('Hide') : t('Show')}</a>
          </div>
          <Collapse in={showOther} >
            <div>
              <div className='profile-list'>
                {otherProfilesSorted.map(
                  profileId => this.renderProfile(profileId, supportedFeatures))}
              </div>
            </div>
          </Collapse>
          {isDeploying ? this.renderOverlay() : null}
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderOverlay(): JSX.Element {
    const {t} = this.props;
    return (
      <div className='profile-overlay'>
        {t('Deployment in progress')}
      </div>
    );
  }

  private sortProfiles(profiles: { [id: string]: IProfile }, language: string) {
    return Object.keys(profiles).sort(
      (lhs: string, rhs: string): number =>
        (profiles[lhs].gameId !== profiles[rhs].gameId)
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

    const { currentProfile, discoveredGames, onSetNextProfile, profiles } = this.props;

    if (profiles[profileId] === undefined) {
      return null;
    }

    const discovered = discoveredGames[profiles[profileId].gameId];
    const available = (discovered !== undefined) && (discovered.path !== undefined);

    return (profileId === this.state.edit) ? null : (
      <ProfileItem
        t={t}
        key={profileId}
        profile={profiles[profileId]}
        features={features}
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

  private toggleOther = () => {
    this.setState(update(this.state, {
      showOther: { $set: !this.state.showOther },
    }));
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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
      <Button bsStyle='ghost' className='profile-add' onClick={this.editNewProfile}>
        {t('Add "{{ name }}" Profile', { replace: { name: gameName } })}
      </Button>
      </div>
    );
  }

  private saveEdit = (profile: IProfile) => {
    const { onAddProfile } = this.props;
    if (profile.id === '__new') {
      const newId: string = shortid();
      const newProf: IProfile = update(profile, { id: { $set: newId } });
      fs.ensureDirAsync(profilePath(newProf))
      .then(() => {
        onAddProfile(newProf);
      });
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
    fs.ensureDirAsync(profilePath(profiles[profileId]))
    .then(() => fs.copyAsync(profilePath(profiles[profileId]), profilePath(newProfile)))
    .then(() => {
      onAddProfile(newProfile);
      this.editExistingProfile(newProfile.id);
    })
    .catch(err => this.context.api.showErrorNotification('Failed to clone profile',
      err, { allowReport: err.code !== 'EPERM' }));
  }

  private onRemoveProfile = (profileId: string) => {
    const { currentProfile, onRemoveProfile, onWillRemoveProfile, onSetNextProfile,
            onShowDialog, profiles } = this.props;
    const confirmText = (profileId === currentProfile)
      ? 'You are trying to remove your currently active profile, "{{profileName}}". '
        + 'This will result in Vortex exiting to the dashboard screen, with no active profile set. '
        + 'Remove this profile? Note: the removed profile cannot be restored!'
      : 'Remove the profile "{{profileName}}"? This can\'t be undone!';
    onShowDialog('question', 'Confirm', {
      text: confirmText,
      parameters: { profileName: profiles[profileId].name },
    }, [
        { label: 'Cancel', default: true },
        {
          label: 'Remove', action:
            () => {
              log('info', 'user removing profile', { id: profileId });
              onWillRemoveProfile(profileId);
              if (profileId === currentProfile) {
                onSetNextProfile(undefined);
              }
              return fs.removeAsync(profilePath(profiles[profileId]))
                .then(() => onRemoveProfile(profileId))
                .catch(err => (err.code === 'ENOENT')
                  ? onRemoveProfile(profileId) // Profile path is already missing, that's fine.
                  : this.context.api.showErrorNotification('Failed to remove profile',
                      err, { allowReport: err.code !== 'EPERM' }));
            },
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
  return path.join(getVortexPath('userData'), profile.gameId, 'profiles', profile.id);
}

const emptyArray = [];

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    gameId,
    currentProfile: state.settings.profiles.activeProfileId,
    profiles: state.persistent.profiles,
    language: state.settings.interface.language,
    games: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    activity: getSafe(state, ['session', 'base', 'activity', 'mods'], emptyArray),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddProfile: (profile: IProfile) => dispatch(setProfile(profile)),
    onRemoveProfile: (profileId: string) => dispatch(removeProfile(profileId)),
    onWillRemoveProfile: (profileId: string) => dispatch(willRemoveProfile(profileId)),
    onSetNextProfile: (profileId: string) => dispatch(setNextProfile(profileId)),
    onSetFeature: (profileId: string, featureId: string, value: any) =>
      dispatch(setFeature(profileId, featureId, value)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      ProfileView)) as React.ComponentClass<{}>;
