import { addRule } from '../actions/userlist';
import * as actions from '../actions/userlistEdit';
import { ILOOTPlugin } from '../types/ILOOTList';

import * as React from 'react';
import { Button, FormControl, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import { ComponentEx, tooltip } from 'vortex-api';

type RuleType = 'after' | 'requires' | 'incompatible';

interface IDialog {
  gameId: string;
  pluginId: string;
  reference: string;
  type: RuleType;
}

interface IConnectedProps {
  dialog: IDialog;
  rules: ILOOTPlugin[];
}

interface IActionProps {
  onCloseDialog: () => void;
  onAddRule: (pluginId: string, reference: string, type: string) => void;
}

interface IComponentState {
  dialog: IDialog;
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
    this.initState({ dialog: undefined });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.nextState.dialog = nextProps.dialog;
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { dialog } = this.state;

    return (
      <Modal show={dialog !== undefined} onHide={this.close}>
        {dialog !== undefined
          ? (
            <Modal.Body>
            {dialog.pluginId}
            <div>
              <tooltip.IconButton
                id='btn-swap-rule-plugins'
                icon='swap-horizontal'
                tooltip={t('Swap plugins')}
                rotate={90}
                onClick={this.swapPlugins}
              />
              <FormControl
                componentClass='select'
                onChange={this.changeType}
                value={dialog.type}
                style={{ marginTop: 20, marginBottom: 20, width: 'initial', display: 'inline' }}
              >
                <option value='after'>{t('Must load after')}</option>
                <option value='requires'>{t('Depends on')}</option>
                <option value='incompatible'>{t('Can\'t be loaded together with')}</option>
              </FormControl>
            </div>
            {dialog.reference}
          </Modal.Body>)
          : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t('Cancel')}</Button>
          <Button onClick={this.save}>{t('Save')}</Button>
        </Modal.Footer>
      </Modal>);
  }

  private swapPlugins = () => {
    const temp = this.nextState.dialog.pluginId;
    this.nextState.dialog.pluginId = this.nextState.dialog.reference;
    this.nextState.dialog.reference = temp;
  }

  private changeType = (event) => {
    this.nextState.dialog.type = event.currentTarget.value;
  }

  private save = () => {
    const { onAddRule, rules } = this.props;
    const { dialog } = this.state;

    onAddRule(dialog.pluginId, dialog.reference, dialog.type);

    this.close();
  }

  private close = () => {
    this.props.onCloseDialog();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const dialog: IDialog = state.session.pluginDependencies.dialog;
  return {
    dialog,
    rules: state.userlist.plugins,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onCloseDialog: () => dispatch(actions.closeDialog()),
    onAddRule: (pluginId, referenceId, type) =>
      dispatch(addRule(pluginId, referenceId, type)),
  };
}

export default translate(['common', 'gamebryo-plugin'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Editor)) as React.ComponentClass<{}>;
