import { setCurrentProfile, setProfile } from '../../../actions/profiles';
import { IProfile } from '../../../types/IProfile';
import { ISettings, IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { Button } from '../../../views/TooltipControls';

import ProfileItem from './ProfileItem';

import * as React from 'react';
import { FormControl, ListGroup, ListGroupItem } from 'react-bootstrap';

import { log } from '../../../util/log';

import update = require('react-addons-update');
import Icon = require('react-fontawesome');

interface IConnectedProps {
  currentProfile: string;
  profiles: { [id: string]: IProfile };
  language: string;
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onSetCurrentProfile: (profileId: string) => void;
}

interface IViewState {
  edit: string;
}

interface IEditState {
  edit: IProfile;
}

interface IEditProps {
  profileId: string;
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
    log('info', 'edit profile', { profile: props.profile, key: props.profileId });
    this.state = props.profile !== undefined
      ? { edit: Object.assign({}, props.profile) }
      : { edit: {
          id: props.profileId,
          modState: {},
          name: '',
        } };
    log('info', 'state', { state: this.state });
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
        onKeyPress={ null }
      />
    );
    return (
      <ListGroupItem key={profileId} header={ inputControl }>
        <Button id='__accept' tooltip={ t('Accept') } onClick={ this.saveEdit }>
          <Icon name='check' />
        </Button>
        <Button id='__cancel' tooltip={ t('Cancel') } onClick={ onCancelEdit }>
          <Icon name='times' />
        </Button>
      </ListGroupItem>
    );
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
      (lhs: string, rhs: string): number => {
        return profiles[lhs].name.localeCompare(profiles[rhs].name, language,
          { sensitivity: 'base' });
    });

    log('info', 'sorted by', { language, sortedProfiles });

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

    const { currentProfile, onSetCurrentProfile, profiles } = this.props;

    log('info', 'render profile', { profileId, profile: profiles[profileId] });
    return (profileId === this.state.edit) ? null : (
      <ProfileItem
        key={ profileId }
        profile={ profiles[profileId] }
        active={ currentProfile === profileId }
        onActivate={ onSetCurrentProfile }
        onStartEditing={ this.editExistingProfile }
      />
    );
  }

  private renderEditProfile(): JSX.Element {
    const { t, profiles } = this.props;
    const { edit } = this.state;
    let profile = undefined;
    if (edit !== '__new') {
      profile = profiles[edit];
    }
    log('info', 'rep', edit);
    return (
      <ProfileEdit
        profileId ={ edit }
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

  private sanitizeProfileId(input: string) {
    // forces id to contain only latin lower case characters and numbers.
    // This is to ensure we never get into trouble storing or transmitting
    // such ids in the future
    return input.toLowerCase().replace(/[^0-9a-z_]/g, (ch) => {
      if (ch === ' ') {
        return '_';
      } else {
        return ch.charCodeAt(0).toString(16);
      }
    });
  }

  private genProfileId(name: string, profiles: { [id: string]: IProfile }) {
      let baseId: string = this.sanitizeProfileId(name);
      let newId: string = baseId;
      let counter: number = 1;
      // ensure the id is non-empty and unused
      while ((profiles.hasOwnProperty(newId)) || (newId === '')) {
        newId = baseId + '_' + counter.toString();
        ++counter;
      }
      return newId;
  }

  private saveEdit = (profile: IProfile) => {
    const { onAddProfile, profiles } = this.props;
    log('info', 'save edit', { profile, key: this.state.edit });
    if (profile.id === '__new') {
      let newId: string = this.genProfileId(profile.name, profiles);
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

  private editExistingProfile = (profileId) => {
    log('info', 'start edit', { profileId });
    this.setState(update(this.state, {
      edit: { $set: profileId },
    }));
  }
}

interface IStateEx extends IState {
  settings: { base: ISettings, interface: { language: string } };
}

function mapStateToProps(state: IStateEx): IConnectedProps {
  return {
    currentProfile: state.gameSettings.profiles.currentProfile,
    profiles: state.gameSettings.profiles.profiles,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onAddProfile: (profile: IProfile) => dispatch(setProfile(profile)),
    onSetCurrentProfile: (profileId: string) => dispatch(setCurrentProfile(profileId)),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(
      ProfileView
    )
  ) as React.ComponentClass<{}>;
