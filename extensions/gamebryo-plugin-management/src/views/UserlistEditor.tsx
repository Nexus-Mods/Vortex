import { addRule, removeRule } from '../actions/userlist';
import { closeDialog } from '../actions/userlistEdit';
import { ILOOTPlugin } from '../types/ILOOTList';

import * as I18next from 'i18next';
import * as React from 'react';
import { Button, FormControl, ListGroup, ListGroupItem, Modal, ModalHeader } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import Select from 'react-select';
import { actions, ComponentEx, Icon, tooltip, types } from 'vortex-api';
import { ILoadOrder } from '../types/ILoadOrder';
import { IPlugins } from '../types/IPlugins';

type RuleType = 'after' | 'requires' | 'incompatible';

interface IRuleEntryProps {
  t: I18next.TranslationFunction;
  pluginId: string;
  reference: string;
  type: RuleType;
  onDelete: (pluginId: string, reference: string, type: RuleType) => void;
}

class RuleEntry extends React.Component<IRuleEntryProps, {}> {
  public render(): JSX.Element {
    const { pluginId, reference, type } = this.props;
    return (
      <ListGroupItem key={`${pluginId}-${type}-${reference}`}>
        {pluginId}
        {' '}
        {this.renderType(type)}
        {' '}
        {reference}
        <tooltip.IconButton
          className='btn-embed'
          icon='remove'
          tooltip=''
          onClick={this.click}
        />
      </ListGroupItem>
    );
  }

  private renderType(type: RuleType) {
    const { t } = this.props;
    switch (type) {
      case 'after': return t('needs to load after');
      case 'requires': return t('requires');
      case 'incompatible': return t('is incompatible with');
    }
  }

  private click = () => {
    const { onDelete, pluginId, reference, type } = this.props;
    onDelete(pluginId, reference, type);
  }
}

interface IDialog {
  gameId: string;
  pluginId: string;
  reference: string;
  type: RuleType;
}

interface IConnectedProps {
  dialog: IDialog;
  userlist: ILOOTPlugin[];
  plugins: IPlugins;
}

interface IActionProps {
  onCloseDialog: () => void;
  onAddRule: (pluginId: string, reference: string, type: string) => void;
  onRemoveRule: (pluginId: string, reference: string, type: string) => void;
}

interface IComponentState {
  dialog: IDialog;
  filter: string;
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
    this.initState({ dialog: undefined, filter: undefined });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.nextState.dialog = nextProps.dialog;
    }
  }

  public render(): JSX.Element {
    const { t, plugins, userlist } = this.props;
    const { dialog, filter } = this.state;

    const pluginNames: string[] = Object.keys(plugins);
    const pluginOptions = pluginNames.map(input => ({ value: input, label: input }));

    return (
      <Modal show={dialog !== undefined} onHide={this.close}>
        <ModalHeader>
          <h3>{t('Set Dependencies')}</h3>
        </ModalHeader>
        {dialog !== undefined
          ? (
            <Modal.Body>
              <Select
                options={pluginOptions}
                placeholder={<div><Icon name='filter' /> {t('Filter by plugin')}</div>}
                value={filter}
                onChange={this.setFilter}
                style={{ maxWidth: '50%' }}
              />
              <ListGroup className='userlist-existing-rules'>
              {userlist.filter(this.filterList).map(this.renderRules)}
              </ListGroup>
              <hr />
                <div className='userlist-add-controls'>
                  <Select
                    options={pluginOptions}
                    clearable={false}
                    placeholder={t('Select Plugin...')}
                    value={dialog.pluginId}
                    onChange={this.selectPlugin}
                  />
                  <Select
                    options={[
                      { value: 'after', label: t('Must Load After') },
                      { value: 'req', label: t('Requires') },
                      { value: 'inc', label: t('Is Incompatible With') },
                    ]}
                    value={dialog.type}
                    clearable={false}
                    onChange={this.selectType}
                  />
                  <Select
                    options={pluginOptions}
                    clearable={false}
                    placeholder={t('Select Plugin...')}
                    value={dialog.reference}
                    onChange={this.selectReference}
                  />
                  <tooltip.IconButton
                    icon='swap'
                    tooltip=''
                    title={t('Swap')}
                    onClick={this.swapPlugins}
                  />
                  <tooltip.Button
                    tooltip=''
                    onClick={this.add}
                    disabled={(dialog.pluginId === undefined) || (dialog.reference === undefined)}
                  >
                    {t('Add')}
                  </tooltip.Button>
                </div>
            </Modal.Body>
          )
          : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t('Close')}</Button>
        </Modal.Footer>
      </Modal>);
  }

  private renderRules = (userlistItem: ILOOTPlugin) => {
    const { t } = this.props;
    const id = userlistItem.name;
    return [].concat(
      (userlistItem.after || []).map((ref: string) => (
        <RuleEntry
          t={t}
          key={`${id}-after-${ref}`}
          pluginId={id}
          reference={ref}
          type='after'
          onDelete={this.deleteRule}
        />)),
      (userlistItem.req || []).map((ref: string) => (
        <RuleEntry
          t={t}
          key={`${id}-req-${ref}`}
          pluginId={id}
          reference={ref}
          type='requires'
          onDelete={this.deleteRule}
        />)),
      (userlistItem.inc || []).map((ref: string) => (
        <RuleEntry
          t={t}
          key={`${id}-inc-${ref}`}
          pluginId={id}
          reference={ref}
          type='incompatible'
          onDelete={this.deleteRule}
        />
      )),
    );
  }

  private deleteRule = (pluginId: string, reference: string, type: RuleType) => {
    const { onRemoveRule } = this.props;
    onRemoveRule(pluginId, reference, type);
  }

  private filterList = (userlistItem: ILOOTPlugin) => {
    const {filter} = this.state;
    if (filter === undefined) {
      return true;
    }

    return userlistItem.name === filter;
  }

  private setFilter = (newValue: { label: string, value: string }) => {
    this.nextState.filter = (newValue === null)
      ? undefined
      : newValue.value;
  }

  private selectPlugin = (newValue: { label: string, value: string }) => {
    this.nextState.dialog.pluginId = newValue.value;
  }

  private selectType = (newValue: { label: string, value: string }) => {
    this.nextState.dialog.type = newValue.value as RuleType;
  }

  private selectReference = (newValue: { label: string, value: string }) => {
    this.nextState.dialog.reference = newValue.value;
  }

  private swapPlugins = () => {
    const temp = this.nextState.dialog.pluginId;
    this.nextState.dialog.pluginId = this.nextState.dialog.reference;
    this.nextState.dialog.reference = temp;
  }

  private changeType = (event) => {
    this.nextState.dialog.type = event.currentTarget.value;
  }

  private add = () => {
    const { onAddRule, userlist } = this.props;
    const { dialog } = this.state;

    const pluginRules = userlist.find(iter => iter.name === dialog.pluginId) || {};

    if ((pluginRules[dialog.type] || []).indexOf(dialog.reference) === -1) {
      // don't set a duplicate of the rule
      onAddRule(dialog.pluginId, dialog.reference, dialog.type);
    }
  }

  private close = () => {
    this.props.onCloseDialog();
  }
}

type IState = types.IState & {
  session: {
    pluginDependencies: any,
  },
  loadOrder: {
    [pluginId: string]: ILoadOrder,
  },
  userlist: any;
};

function mapStateToProps(state: any): IConnectedProps {
  const dialog: IDialog = state.session.pluginDependencies.dialog;
  return {
    dialog,
    plugins: state.session.plugins.pluginList,
    userlist: state.userlist.plugins,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onCloseDialog: () => dispatch(closeDialog()),
    onAddRule: (pluginId, referenceId, type) =>
      dispatch(addRule(pluginId, referenceId, type)),
    onRemoveRule: (pluginId, referenceId, type) =>
      dispatch(removeRule(pluginId, referenceId, type)),
  };
}

export default translate(['common', 'gamebryo-plugin'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Editor)) as React.ComponentClass<{}>;
