import { addRule, removeRule } from '../actions/userlist';
import { closeDialog } from '../actions/userlistEdit';
import { ILOOTPlugin } from '../types/ILOOTList';
import { IPlugins } from '../types/IPlugins';

import I18next from 'i18next';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem, Modal, ModalHeader } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import Select, { SingleValue } from 'react-select';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { ComponentEx, Icon, tooltip, types } from 'vortex-api';
import { IStateEx } from '../types/IStateEx';

type RuleType = 'after' | 'requires' | 'incompatible';

interface ISelectOption {
  value: string;
  label: string;
}

interface IRuleTypeOption {
  value: RuleType;
  label: string;
}

interface IRuleEntryProps {
  t: typeof I18next.t;
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

export interface IDialog {
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
  filter: ISelectOption;
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

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (nextProps.dialog !== this.props.dialog) {
      this.nextState.dialog = nextProps.dialog !== undefined ? { ...nextProps.dialog } : undefined;
    }
  }

  public render(): JSX.Element {
    const { t, plugins, userlist } = this.props;
    const { dialog, filter } = this.state;

    const pluginNames: string[] = Object.keys(plugins);
    const pluginOptions: ISelectOption[] = pluginNames.map(input => ({ value: input, label: input }));

    return (
      <Modal id='manage-plugin-rules-dialog' show={dialog !== undefined} onHide={this.close}>
        <ModalHeader>
          <h3>{t('Set Rules')}</h3>
        </ModalHeader>
        {dialog !== undefined
          ? (
            <Modal.Body>
              <Select<ISelectOption>
                options={pluginOptions}
                placeholder={<div><Icon name='filter' />{t('Filter by plugin')}</div>}
                value={filter}
                onChange={this.setFilter}
                styles={{ container: (provided) => ({ ...provided, maxWidth: '50%' }) }}
              />
              <ListGroup className='userlist-existing-rules'>
              {userlist.filter(this.filterList).map(this.renderRules)}
              </ListGroup>
              <hr />
                <div className='userlist-add-controls'>
                  <Select<ISelectOption>
                    className='userlist-select-plugin'
                    options={pluginOptions}
                    isClearable={false}
                    placeholder={t('Select Plugin...')}
                    value={pluginOptions.find(option => option.value === dialog.pluginId) || null}
                    onChange={this.selectPlugin}
                  />
                  <Select<IRuleTypeOption>
                    options={[
                      { value: 'after', label: t('Must Load After') },
                      { value: 'requires', label: t('Requires') },
                      { value: 'incompatible', label: t('Is Incompatible With') },
                    ]}
                    value={dialog.type ? (() => {
                      const typeLabels = {
                        'after': t('Must Load After'),
                        'requires': t('Requires'),
                        'incompatible': t('Is Incompatible With')
                      };
                      return { value: dialog.type, label: typeLabels[dialog.type] };
                    })() : null}
                    isClearable={false}
                    onChange={this.selectType}
                  />
                  <Select<ISelectOption>
                    className='userlist-select-plugin select-pull-right'
                    options={pluginOptions}
                    isClearable={false}
                    placeholder={t('Select Plugin...')}
                    value={dialog.reference ? { value: dialog.reference, label: dialog.reference } : null}
                    onChange={(newValue: ISelectOption | null) => this.selectReference(newValue)}
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
      </Modal>
      );
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
        />
      )),
      (userlistItem.req || []).map((ref: string) => (
        <RuleEntry
          t={t}
          key={`${id}-req-${ref}`}
          pluginId={id}
          reference={ref}
          type='requires'
          onDelete={this.deleteRule}
        />
      )),
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

    return userlistItem.name === filter.value;
  }

  private setFilter = (newValue: SingleValue<ISelectOption>) => {
    this.nextState.filter = (newValue === null) 
      ? undefined 
      : newValue;
  }

  private selectPlugin = (newValue: SingleValue<ISelectOption>) => {
    if (newValue === null) {
      return;
    }
    this.nextState.dialog.pluginId = newValue.value;
  }

  private selectType = (newValue: { label: string, value: string }) => {
    if (newValue === null) {
      return;
    }
    this.nextState.dialog.type = newValue.value as RuleType;
  }

  private selectReference = (newValue: ISelectOption | null) => {
    if (newValue) {
      this.nextState.dialog.reference = newValue.value;
    }
  }

  private swapPlugins = () => {
    const temp = this.nextState.dialog.pluginId;
    this.nextState.dialog.pluginId = this.nextState.dialog.reference;
    this.nextState.dialog.reference = temp;
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

const emptyObject = {};
const emptyList = [];

function mapStateToProps(state: IStateEx): IConnectedProps {
  const dialog: IDialog = state.session.pluginDependencies.dialog;
  return {
    dialog,
    plugins: state.session.plugins.pluginList ?? emptyObject,
    userlist: state.userlist.plugins ?? emptyList,
  };
}

type Dispatch = ThunkDispatch<types.IState, null, Redux.Action>;

function mapDispatchToProps(dispatch: Dispatch): IActionProps {
  return {
    onCloseDialog: () => dispatch(closeDialog()),
    onAddRule: (pluginId, referenceId, type) =>
      dispatch(addRule(pluginId, referenceId, type)),
    onRemoveRule: (pluginId, referenceId, type) =>
      dispatch(removeRule(pluginId, referenceId, type)),
  };
}

export default withTranslation(['common', 'gamebryo-plugin-management'])(
  connect(mapStateToProps, mapDispatchToProps)(Editor) as any) as React.ComponentClass<{}>;
