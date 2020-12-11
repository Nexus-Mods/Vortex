import Toggle from '../../../controls/Toggle';
import {Button} from '../../../controls/TooltipControls';
import {ComponentEx} from '../../../util/ComponentEx';
import {getSafe, setSafe} from '../../../util/storeHelper';

import {IProfile} from '../types/IProfile';
import {IProfileFeature} from '../types/IProfileFeature';

import update from 'immutability-helper';
import * as React from 'react';
import {FormControl, ListGroupItem, Panel} from 'react-bootstrap';

export interface IEditState {
  edit: IProfile;
  features: IProfileFeature[];
}

export interface IEditProps {
  profileId: string;
  gameId: string;
  profile?: IProfile;
  features: IProfileFeature[];
  onSetFeature: (profileId: string, featureId: string, value: any) => void;
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
    const features = props.features.filter(feature => feature.supported());

    this.state = props.profile !== undefined
      ? {
        edit: { ...props.profile },
        features,
      }
      : {
        edit: {
          id: props.profileId,
          gameId: props.gameId,
          modState: {},
          name: '',
          lastActivated: 0,
        },
        features,
      };
  }

  public UNSAFE_componentWillReceiveProps(newProps: IEditProps) {
    if (this.props.gameId !== newProps.gameId) {
      this.setState(update(this.state, {
        features: { $set: newProps.features.filter(feature => feature.supported()) },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, onCancelEdit, profile, profileId } = this.props;
    const { edit, features } = this.state;
    const inputControl = (
      <FormControl
        autoFocus
        type='text'
        value={edit.name}
        onChange={this.changeEditName}
        onKeyPress={this.handleKeypress}
        style={{flexGrow: 1}}
      />
    );

    const PanelX: any = Panel;
    return (
      <Panel className='profile-edit-panel'>
        <Panel.Body>
          {profile === undefined ? t('Create a new profile') : t('Edit profile')}
          <ListGroupItem key={profileId}>
            <div className='inline-form'>
            {inputControl}
            <Button bsStyle='primary' id='__accept' tooltip={t('Accept')} onClick={this.saveEdit}>
              {t('Save')}
            </Button>
            <Button bsStyle='secondary' id='__cancel' tooltip={t('Cancel')} onClick={onCancelEdit}>
              {t('Cancel')}
            </Button>
            </div>
            <div>
              {features.map(this.renderFeature)}
            </div>
          </ListGroupItem>
        </Panel.Body>
      </Panel>
    );
  }

  private renderFeature = (feature: IProfileFeature) => {
    const { t } = this.props;
    const { edit } = this.state;
    if (feature.type === 'boolean') {
      return (
        <Toggle
          checked={getSafe(edit, ['features', feature.id], false)}
          dataId={feature.id}
          onToggle={this.toggleCheckbox}
          key={feature.id}
        >
          {t(feature.description)}
        </Toggle>
      );
    } else if (feature.type === 'text') {
      return (
        <FormControl
          componentClass='textarea'
          value={getSafe(edit, ['features', feature.id], undefined) ?? ''}
          data-id={feature.id}
          onChange={this.assignString}
          placeholder={t(feature.description)}
        />
      );
    }
  }

  private toggleCheckbox = (ticked: boolean, dataId: string) => {
    this.setState(setSafe(this.state, ['edit', 'features', dataId], ticked));
  }

  private assignString = (evt: React.FormEvent<any>) => {
    const dataId = evt.currentTarget.getAttribute('data-id');
    const value = evt.currentTarget.value;
    this.setState(setSafe(this.state, ['edit', 'features', dataId], value));
  }

  private handleKeypress = (evt: React.KeyboardEvent<any>) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      this.saveEdit();
    }
  }

  private saveEdit = () => {
    this.props.onSaveEdit(this.state.edit);
  }

  private changeEditName = (evt) => {
    this.setState(update(this.state, {
      edit: {
        name: { $set: evt.target.value },
      },
    }));
  }
}

export default ProfileEdit;
