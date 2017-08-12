import * as actions from '../actions/transferSetup';
import { IProfile } from '../types/IProfile';

import { ComponentEx, log, tooltip } from 'nmm-api';
import * as React from 'react';
import { Button, Checkbox, FormControl, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IDialog {
  gameId: string;
  source: IProfile;
  target: IProfile;
  profiles: IProfile[];
}

interface IConnectedProps {
  dialog: IDialog;
}

interface IActionProps {
  onCloseDialog: () => void;
}

interface IComponentState {
  dialog: IDialog;
  setLoadOrder: boolean;
  setModOrder: boolean;
}

type IProps = IConnectedProps & IActionProps;

/**
 * simple dialog to set userlist rule between two plugins
 *
 * @class Editor
 * @extends {ComponentEx<IProps, IComponentState>}
 */
class Editor extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({ dialog: undefined, setLoadOrder: false, setModOrder: false });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.nextState.dialog = nextProps.dialog;
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { dialog } = this.state;
    let profiles;
    if (dialog !== undefined) {
      profiles = dialog.profiles;
    }

    return (
      <Modal show={dialog !== undefined} onHide={this.close}>
        {dialog !== undefined
          ? (
            <Modal.Body>
            <div>
              <FormControl
                componentClass='select'
                onChange={this.changeSource}
                value={dialog.source.id}
                style={{ marginTop: 20, marginBottom: 20, width: 'initial', display: 'inline' }}
              >
              {profiles.map(this.renderProfileOptions)}
              </FormControl>
              <tooltip.IconButton
                id='btn-swap-profiles'
                icon='swap-horizontal'
                tooltip={t('Swap profiles')}
                rotate={90}
                onClick={this.swapProfiles}
              />
              <FormControl
                componentClass='select'
                onChange={this.changeTarget}
                value={dialog.target.id}
                style={{ marginTop: 20, marginBottom: 20, width: 'initial', display: 'inline' }}
              >
              {profiles.map(this.renderProfileOptions)}
              </FormControl>
            </div>
            <div>
            <Checkbox
                checked={false}
                onChange={this.toggleLoadOrder}
                style={{ display: 'inline' }}
              >
                {t('Transfer Load Order')}
            </Checkbox>
            </div>
            <div>
            <Checkbox
                checked={false}
                onChange={this.toggleModOrder}
                style={{ display: 'inline' }}
              >
                {t('Transfer Mod Order')}
            </Checkbox>
            </div>
          </Modal.Body>)
          : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t('Cancel')}</Button>
          <Button onClick={this.apply}>{t('Apply')}</Button>
        </Modal.Footer>
      </Modal>);
  }

  private renderProfileOptions(profile: IProfile): JSX.Element {
    return (
      <option key={profile.id} value={profile.id }>{profile.name}</option>
    );
  }

  private swapProfiles = () => {
    const temp = this.nextState.dialog.target;
    this.nextState.dialog.source = this.nextState.dialog.target;
    this.nextState.dialog.target = temp;
  }

  private changeSource = (event) => {
    this.nextState.dialog.source = event.currentTarget.value;
  }

  private toggleLoadOrder = (event) => {
    this.nextState.setLoadOrder = event.currentTarget.value;
  }

  private toggleModOrder = (event) => {
    this.nextState.setModOrder = event.currentTarget.value;
  }

  private changeTarget = (event) => {
    this.nextState.dialog.target = event.currentTarget.value;
  }

  private apply = () => {
    const { dialog } = this.state;
    // Apply edits to target profile
    this.close();
  }

  private close = () => {
    this.props.onCloseDialog();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const dialog: IDialog = state.session.profileTransfer.dialog;
  return {
    dialog,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onCloseDialog: () => dispatch(actions.closeDialog()),
  };
}

export default translate(['common', 'profile-management'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Editor)) as React.ComponentClass<{}>;
