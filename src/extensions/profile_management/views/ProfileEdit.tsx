import Icon from '../../../controls/Icon';
import {Button} from '../../../controls/TooltipControls';
import {ComponentEx} from '../../../util/ComponentEx';
import {getSafe, setSafe} from '../../../util/storeHelper';

import {IProfile} from '../types/IProfile';
import {IProfileFeature} from '../types/IProfileFeature';

import * as update from 'immutability-helper';
import * as React from 'react';
import {Checkbox, FormControl, ListGroupItem} from 'react-bootstrap';

export interface IEditState {
  edit: IProfile;
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
    this.state = props.profile !== undefined
      ? { edit: { ...props.profile } }
      : { edit: {
          id: props.profileId,
          gameId: props.gameId,
          modState: {},
          name: '',
        } };
  }

  public render(): JSX.Element {
    const { t, features, profileId, onCancelEdit } = this.props;
    const { edit } = this.state;
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
    return (
      <ListGroupItem key={profileId}>
        <div className='inline-form'>
        {inputControl}
        <Button id='__accept' tooltip={t('Accept')} onClick={this.saveEdit}>
          <Icon name='check' />
        </Button>
        <Button id='__cancel' tooltip={t('Cancel')} onClick={onCancelEdit}>
          <Icon name='remove' />
        </Button>
        </div>
        <div>
        {features.map(this.renderFeature)}
        </div>
      </ListGroupItem>
    );
  }

  private renderFeature = (feature: IProfileFeature) => {
    const { t } = this.props;
    const { edit } = this.state;
    if (feature.type === 'boolean') {
      return (
        <Checkbox
          id={feature.id}
          key={feature.id}
          checked={getSafe(edit, ['features', feature.id], false)}
          onChange={this.toggleCheckbox}
        >
          {t(feature.description)}
        </Checkbox>
      );
    }
  }

  private toggleCheckbox = (evt: React.MouseEvent<any>) => {
    const featureId = evt.currentTarget.id;
    const ticked = evt.currentTarget.checked;

    this.setState(setSafe(this.state, ['edit', 'features', featureId], ticked));
  }

  private handleKeypress = (evt: React.KeyboardEvent<any>) => {
    if (evt.which === 13) {
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
