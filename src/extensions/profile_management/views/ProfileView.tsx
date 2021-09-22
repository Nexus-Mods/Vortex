import { DialogActions, DialogType, IDialogContent, IDialogResult,
         showDialog } from '../../../actions/notifications';
import { IMod, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { activeGameId, lastActiveProfileForGame } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';

import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { removeProfile, setFeature, setProfile, willRemoveProfile } from '../actions/profiles';
import { clearLastActiveProfile, setNextProfile } from '../actions/settings';
import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import ProfileEdit from './ProfileEdit';
import ProfileItem from './ProfileItem';

import { remote, shell } from 'electron';
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
  mods: { [modId: string]: IMod };
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onRemoveProfile: (profileId: string) => void;
  onClearLastActiveProfile: (gameId: string) => void;
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

    const isDeploying = activity.includes('deployment') || activity.includes('purging');

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
    const { t, mods } = this.props;
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
        mods={mods}
        features={features}
        active={currentProfile === profileId}
        available={available}
        onClone={this.onCloneProfile}
        onRemove={this.onRemoveProfile}
        onActivate={onSetNextProfile}
        onStartEditing={this.editExistingProfile}
        highlightGameId={this.state.highlightGameId}
        onSetHighlightGameId={this.setHighlightGameId}
        onCreateShortcut={this.setShortcut}
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

  private setShortcut = (profileId: string) => {
    const { t, profiles } = this.props;
    const profile = profiles[profileId];
    const appDir = (process.env.NODE_ENV !== 'development')
      ? path.dirname(remote.app.getPath('exe'))
      : 'C:/Program Files/Black Tree Gaming Ltd/Vortex';

    const desktopLocation = remote.app.getPath('desktop');
    const shortcutPath = path.join(desktopLocation, `Start Vortex Profile_${profileId}(${profile.gameId}).lnk`);
    const created = shell.writeShortcutLink(shortcutPath, 'create', {
      target: path.join(appDir, 'Vortex.exe'),
      args: `--profile ${profileId}`,
    });

    const displayMS = 5000;
    const message = created
      ? t('Vortex profile shortcut saved to desktop')
      : t('Failed to save profile shortcut to desktop');

    const type = created ? 'info' : 'error';
    this.context.api.sendNotification({ message, type, displayMS });
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
    let gameName = getSafe(discovered, ['name'], getSafe(game, ['name'], ''));
    if (gameName !== undefined) {
      gameName = gameName.split('\t').map(part => t(part)).join(' ');
    }

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
    const { activity, currentProfile, onClearLastActiveProfile,
            onRemoveProfile, onWillRemoveProfile, onSetNextProfile,
            onShowDialog, profiles } = this.props;

    const gameMode = profiles[profileId].gameId;
    const totalProfilesForGame = (gameMode)
      ? Object.keys(profiles).filter(id => profiles[id].gameId === gameMode).length
      : 0;
    let confirmText = (profileId === currentProfile)
      ? 'You are trying to remove your currently active profile, "{{profileName}}". '
        + 'This will result in Vortex exiting to the dashboard screen, with no active profile set. '
        + 'Remove this profile? Note: the removed profile cannot be restored!'
      : 'Remove the profile "{{profileName}}"? This can\'t be undone!';
    confirmText = (totalProfilesForGame === 1)
      ? confirmText + ' As this is your only profile for this game, removing it will unmanage the '
                    + 'game within Vortex!'
      : confirmText;
    onShowDialog('question', 'Confirm', {
      text: confirmText,
      parameters: { profileName: profiles[profileId].name },
    }, [
        { label: 'Cancel', default: true },
        {
          label: 'Remove', action:
            () => {
              log('info', 'user removing profile', { id: profileId });
              if (activity.includes('deployment')) {
                log('info', 'refusing to remove profile during deployment');
                return;
              }

              onWillRemoveProfile(profileId);
              if (profileId === currentProfile) {
                onSetNextProfile(undefined);
              }
              const doRemoveProfile = () => {
                onRemoveProfile(profileId);
                if (gameMode !== undefined) {
                  // It's possible that this is the last active profile
                  //  for this game - we need to remove the last active
                  //  game entry.
                  const state = this.context.api.getState();
                  const lastActiveProfileId = lastActiveProfileForGame(state, gameMode);
                  if (profileId === lastActiveProfileId) {
                    onClearLastActiveProfile(gameMode);
                  }
                }
              };
              return fs.removeAsync(profilePath(profiles[profileId]))
                .then(() => doRemoveProfile())
                .catch(err => (err.code === 'ENOENT')
                  ? doRemoveProfile() // Profile path is already missing, that's fine.
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
  return path.join(remote.app.getPath('userData'), profile.gameId, 'profiles', profile.id);
}

const emptyArray = [];
const emptyObject = {};

function mapStateToProps(state: IState): IConnectedProps {
  const gameId = activeGameId(state);
  return {
    gameId,
    currentProfile: state.settings.profiles.activeProfileId,
    profiles: state.persistent.profiles,
    language: state.settings.interface.language,
    mods: state.persistent.mods[gameId] || emptyObject,
    games: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    activity: getSafe(state, ['session', 'base', 'activity', 'mods'], emptyArray),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddProfile: (profile: IProfile) => dispatch(setProfile(profile)),
    onRemoveProfile: (profileId: string) => dispatch(removeProfile(profileId)),
    onClearLastActiveProfile: (gameId: string) => dispatch(clearLastActiveProfile(gameId)),
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
