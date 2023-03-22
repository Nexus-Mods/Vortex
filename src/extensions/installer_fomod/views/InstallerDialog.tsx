import FlexLayout from '../../../controls/FlexLayout';
import Modal from '../../../controls/Modal';
import Spinner from '../../../controls/Spinner';
import { IconButton } from '../../../controls/TooltipControls';
import ZoomableImage from '../../../controls/ZoomableImage';
import { connect, PureComponentEx, translate } from '../../../util/ComponentEx';
import { pushSafe, removeValue } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import {
  GroupType, IGroup, IHeaderImage, IInstallerState, IInstallStep,
  IPlugin, OrderType,
} from '../types/interface';

import { TFunction } from 'i18next';
import update from 'immutability-helper';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import {
  Button, Checkbox, ControlLabel, Form, FormGroup, Pager,
  ProgressBar, Radio,
} from 'react-bootstrap';
import { pathToFileURL } from 'url';

interface IGroupProps {
  t: TFunction;
  disabled: boolean;
  stepId: number;
  group: IGroup;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
}

interface IGroupState {
  selectedPlugins: number[];
  // localUpdate stores when the last local update has been made. This is used
  // to prevent top-down updates from undoing them if the remote process takes
  // long to reply
  localUpdate: number;
  sentUpdate: number;
  confirmedUpdate: number;
}

const nop = () => undefined;

class Group extends React.PureComponent<IGroupProps, IGroupState> {
  private mValidate: (selected: number[]) => string;
  constructor(props: IGroupProps) {
    super(props);
    this.state = {
      selectedPlugins: this.getSelectedPlugins(props),
      localUpdate: 0,
      sentUpdate: 0,
      confirmedUpdate: 1,
    };
  }

  public componentDidUpdate(oldProps: IGroupProps, oldState: IGroupState) {
    const {group, onSelect} = this.props;
    const {confirmedUpdate, localUpdate, sentUpdate, selectedPlugins} = this.state;
    const valid: string = this.validateFunc(group.type)(selectedPlugins);
    if ((selectedPlugins !== oldState.selectedPlugins)
        && (localUpdate > sentUpdate)
        // if the confirmation is still pending, don't send now
        && (confirmedUpdate >= sentUpdate)) {
      onSelect(group.id, selectedPlugins, valid === undefined);
      this.setState(update(this.state, { sentUpdate: { $set: Date.now() } }));
    }
  }

  public UNSAFE_componentWillReceiveProps(newProps: IGroupProps) {
    if (!_.isEqual(this.props.group, newProps.group)) {
      // based on the rules of the fomod, us selecting an option may make other options
      // unavailable. However, for usability reasons, we don't undo user selections if the user
      // has made further changes since last sending an update
      if (this.state.sentUpdate >= this.state.localUpdate) {
        this.setState(update(this.state, {
          selectedPlugins: { $set: this.getSelectedPlugins(newProps) },
          confirmedUpdate: { $set: Date.now() },
        }));
      } else if (this.state.localUpdate > this.state.sentUpdate) {
        // while confirmation was pending, the user made further changes, validate them now
        const { group, onSelect } = newProps;
        const { selectedPlugins } = this.state;
        const valid: string = this.validateFunc(group.type)(selectedPlugins);
        onSelect(group.id, selectedPlugins, valid === undefined);
        this.setState(update(this.state, { sentUpdate: { $set: Date.now() } }));
      }
      this.mValidate = this.validateFunc(newProps.group.type);
    }
  }

  public UNSAFE_componentWillMount() {
    const { group, onSelect } = this.props;
    const { selectedPlugins } = this.state;
    this.mValidate = this.validateFunc(group.type);
    if (this.mValidate(selectedPlugins) !== undefined) {
      onSelect(group.id, selectedPlugins, false);
    }
  }

  public render(): JSX.Element {
    const {t, disabled, group} = this.props;
    const {selectedPlugins} = this.state;

    const validationMessage = this.mValidate(selectedPlugins);
    const validationState = validationMessage === undefined ? null : 'error';

    return (
      <FormGroup disabled={disabled} validationState={validationState}>
        <ControlLabel>
          {group?.name ?? `<${t('Missing group name')}>`}
          {' '}
          {validationMessage ? `(${validationMessage})` : null}
        </ControlLabel>
        {this.renderNoneOption()}
        {group.options.map(this.renderPlugin)}
      </FormGroup>
    );
  }

  private getSelectedPlugins(props: IGroupProps) {
    return props.group.options
      .filter(plugin => plugin.selected)
      .map(plugin => plugin.id);
  }

  private validateFunc(type: GroupType): (selected: number[]) => string {
    const { t } = this.props;
    switch (type) {
      case 'SelectAtLeastOne': return (selected: number[]) => (selected.length === 0)
        ? t('Select at least one') : undefined;
      case 'SelectAtMostOne': return (selected: number[]) => (selected.length > 1)
        ? t('Select at most one') : undefined;
      case 'SelectExactlyOne': return (selected: number[]) => (selected.length !== 1)
        ? t('Select exactly one') : undefined;
      default: return () => undefined;
    }
  }

  private renderNoneOption = (): JSX.Element => {
    const {t, disabled, group, stepId} = this.props;
    const {selectedPlugins} = this.state;

    if (group.type !== 'SelectAtMostOne') {
      return null;
    }

    const isSelected = selectedPlugins.length === 0;
    return (
      <Radio
        id={`radio-${stepId}-${group.id}-none`}
        key='none'
        disabled={disabled}
        name={group.id.toString()}
        data-value='none'
        checked={isSelected}
        onChange={this.select}
      >{t('None')}
      </Radio>
    );
  }

  private renderPlugin = (plugin: IPlugin): JSX.Element => {
    const {t, disabled, group, stepId} = this.props;
    const {selectedPlugins} = this.state;

    const isSelected = selectedPlugins.includes(plugin.id);
    const id = `${stepId}-${group.id}-${plugin.id}`;
    const readOnly = plugin.type === 'Required';

    const content = (
      <a
        className='fake-link'
        data-value={plugin.id}
        onMouseOver={this.showDescription}
      >
        {plugin.name}
        {plugin.preset ? ` (${t('Preset')})` : ''}
      </a>
    );
    switch (group.type) {
      case 'SelectExactlyOne':
      case 'SelectAtMostOne':
        return (
          <Radio
            id={'radio-' + id}
            key={plugin.id}
            data-value={plugin.id}
            name={group.id.toString()}
            checked={isSelected}
            onChange={readOnly ? nop : this.select}
            disabled={disabled || (plugin.type === 'NotUsable')}
            title={plugin.conditionMsg}
          >
            {content}
          </Radio>
        );
      case 'SelectAll':
        return (
          <Checkbox
            id={'checkbox-' + id}
            key={plugin.id}
            checked={isSelected}
            data-value={plugin.id}
            disabled={true}
          >
            {content}
          </Checkbox>
        );
      default:
        return (
          <Checkbox
            id={'checkbox-' + id}
            key={plugin.id}
            data-value={plugin.id}
            checked={isSelected}
            disabled={disabled || (plugin.type === 'NotUsable')}
            onChange={readOnly ? nop : this.select}
            title={plugin.conditionMsg}
          >
            {content}
          </Checkbox>
        );
    }
  }

  private showDescription = (evt: React.FormEvent<any>) => {
    const {group, onShowDescription} = this.props;

    const pluginId = parseInt(evt.currentTarget.getAttribute('data-value'), 10);
    const {image, description} = group.options[pluginId];

    onShowDescription(image, description);
  }

  private select = (evt: React.FormEvent<any>) => {
    const {group, onShowDescription} = this.props;

    const value = evt.currentTarget.getAttribute('data-value');
    if (value === 'none') {
      this.setState(update(this.state, {
        selectedPlugins: { $set: [] },
        localUpdate: { $set: Date.now() },
      }));
      onShowDescription(undefined, undefined);
      return;
    }

    const pluginId = parseInt(value, 10);

    this.showDescription(evt);

    if (['SelectExactlyOne', 'SelectAtMostOne'].indexOf(group.type) !== -1) {
      this.setState(update(this.state, {
        selectedPlugins: { $set: [pluginId] },
        localUpdate: { $set: Date.now() },
      }));
    } else if (this.state.selectedPlugins.indexOf(pluginId) === -1) {
      this.setState(update(this.state, {
        selectedPlugins: { $set: [].concat(this.state.selectedPlugins, [pluginId]) },
        localUpdate: { $set: Date.now() },
      }));
    } else {
      this.setState(update(this.state, {
        selectedPlugins: { $set: this.state.selectedPlugins.filter(iter => iter !== pluginId) },
        localUpdate: { $set: Date.now() },
      }));
    }
  }
}

function getGroupSortFunc(order: OrderType) {
  if (order === 'AlphaDesc') {
    return (lhs: IGroup, rhs: IGroup) => rhs.name.localeCompare(lhs.name);
  } else {
    return (lhs: IGroup, rhs: IGroup) => lhs.name.localeCompare(rhs.name);
  }
}

interface IStepProps {
  t: TFunction;
  step: IInstallStep;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
  disabled: boolean;
}

function Step(props: IStepProps) {
  let groupsSorted: IGroup[];
  if (props.step.optionalFileGroups.group === undefined) {
    return null;
  }
  if (props.step.optionalFileGroups.order === 'Explicit') {
    groupsSorted = props.step.optionalFileGroups.group;
  } else {
    const sortFunc = getGroupSortFunc(props.step.optionalFileGroups.order);
    groupsSorted = props.step.optionalFileGroups.group.slice(0).sort(sortFunc);
  }

  return (
    <Form disabled={props.disabled} id='fomod-installer-form'>
      {groupsSorted.map((group: IGroup) => (
        <Group
          t={props.t}
          disabled={props.disabled}
          key={`${props.step.id}-${group.id}`}
          stepId={props.step.id}
          group={group}
          onSelect={props.onSelect}
          onShowDescription={props.onShowDescription}
        />
      ))}
    </Form>
  );
}

interface IInstallerInfo {
  moduleName: string;
  image: IHeaderImage;
}

export interface IBaseProps {
}

interface IConnectedProps {
  dataPath: string;
  installerInfo: IInstallerInfo;
  installerState: IInstallerState;
}

interface IDialogState {
  invalidGroups: string[];
  currentImage: string;
  currentDescription: string;
  waiting: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class InstallerDialog extends PureComponentEx<IProps, IDialogState> {
  constructor(props: IProps) {
    super(props);
    this.state = this.initDescription(props);
  }
  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (
      // when initiating the dialog
      ((this.props.installerState === undefined) && (nextProps.installerState !== undefined))
      // and any time we change to a different page (forward or backwards)
      || ((this.props.installerState !== undefined)
          && (nextProps.installerState !== undefined)
          && ((this.props.installerInfo !== nextProps.installerInfo)
            || (this.props.installerState.currentStep !== nextProps.installerState.currentStep)))) {
      // fully update the description
      this.setState(this.initDescription(nextProps));
    }
  }
  public render(): JSX.Element {
    const { t, installerInfo, installerState } = this.props;
    const { currentDescription, waiting } = this.state;
    if (!truthy(installerInfo) || !truthy(installerState)) {
      return null;
    }
    const idx = installerState.currentStep;
    const steps = installerState.installSteps;
    const nextVisible = steps.find((step: IInstallStep, i: number) => i > idx && step.visible);
    let lastVisible: IInstallStep;
    steps.forEach((step: IInstallStep, i: number) => {
      if ((i < idx) && step.visible) {
        lastVisible = step;
      }
    });
    const nextDisabled = this.state.invalidGroups.length > 0;
    return (
      <Modal
        id='fomod-installer-dialog'
        show={true}
        onHide={this.nop}
      >
        <Modal.Header>
          <Modal.Title>
            {installerInfo.moduleName}
          </Modal.Title>
          {steps[idx].name}
          <IconButton
            id='fomod-cancel'
            className='close-button'
            tooltip={t('Cancel')}
            icon='close'
            onClick={this.cancel}
          />
        </Modal.Header>
        <Modal.Body>
          <FlexLayout type='row' style={{ position: 'relative' }}>
            <FlexLayout.Flex fill style={{ overflowY: 'auto' }}>
              <Step
                t={t}
                step={steps[idx]}
                onSelect={this.select}
                onShowDescription={this.showDescription}
                disabled={waiting}
              />
            </FlexLayout.Flex>
            <FlexLayout.Fixed style={{ maxWidth: '60%', minWidth: '40%', overflowY: 'auto' }}>
              <FlexLayout type='column'>
                <FlexLayout.Flex>
                  {this.renderImage()}
                </FlexLayout.Flex>
                <FlexLayout.Flex fill className='description'>
                  <ControlLabel readOnly={true}>{currentDescription}</ControlLabel>
                </FlexLayout.Flex>
              </FlexLayout>
            </FlexLayout.Fixed>
          </FlexLayout>
        </Modal.Body>
        <Modal.Footer>
          <div className='fomod-nav-buttons'>
            <div>{
              lastVisible !== undefined
                ? (
                  <Button onClick={this.prev} disabled={waiting}>
                    {waiting ? <Spinner /> : lastVisible.name || t('Previous')}
                  </Button>
                ) : null
            }</div>
            <div className='fomod-progress'>
              <ProgressBar now={idx} max={steps.length - 1} />
            </div>
            <div>{
              nextVisible !== undefined
                ? (
                  <Button disabled={nextDisabled || waiting} onClick={this.next}>
                    {waiting ? <Spinner /> : (nextVisible.name || t('Next'))}
                  </Button>
                ) : (
                  <Button disabled={nextDisabled || waiting} onClick={this.next}>
                    {t('Finish')}
                  </Button>
                )
            }</div>
          </div>
        </Modal.Footer>
      </Modal>
    );
  }
  private nop = () => undefined;

  private select = (groupId: number, plugins: number[], valid: boolean) => {
    const {events} = this.context.api;
    const {installerState} = this.props;
    let newState = this.state;
    newState = valid
      ? removeValue(newState, ['invalidGroups'], groupId)
      : pushSafe(newState, ['invalidGroups'], groupId);

    events.emit('fomod-installer-select',
      installerState.installSteps[installerState.currentStep].id, groupId, plugins);
    this.setState(newState);
  }

  private renderImage = () => {
    const { dataPath, installerInfo } = this.props;
    const { currentImage } = this.state;

    const image = currentImage || installerInfo.image.path;

    if (!truthy(dataPath) || !truthy(image)) {
      return null;
    }

    return (
      <ZoomableImage
        url={pathToFileURL(path.join(dataPath, image)).href}
        className='installer-image'
        overlayClass='installer-zoom'
        container={null}
      />
    );
  }

  private initDescription(props: IProps): IDialogState {
    const ret = (option) => ({
      invalidGroups: [],
      currentImage: option.image,
      currentDescription: option.description,
      waiting: false,
    });

    if (!truthy(props.installerState)) {
      return ret({});
    }
    const { currentStep, installSteps } = props.installerState;

    const selOption = (installSteps[currentStep]?.optionalFileGroups?.group?.[0]?.options ?? [])
      .find(opt => opt.selected);
    return ret(selOption || {});
  }

  private showDescription = (image: string, description: string) => {
    this.setState(update(this.state, {
      currentDescription: { $set: description },
      currentImage: { $set: image },
    }));
  }
  private prev = () => {
    const { events } = this.context.api;
    this.setState(update(this.state, {
      waiting: { $set: true },
    }));
    events.emit('fomod-installer-continue', 'back', this.props.installerState.currentStep);
  }
  private next = () => {
    const { events } = this.context.api;
    this.setState(update(this.state, {
      waiting: { $set: true },
    }));
    events.emit('fomod-installer-continue', 'forward', this.props.installerState.currentStep);
  }
  private cancel = () => this.context.api.events.emit('fomod-installer-cancel');
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    dataPath: state.session.fomod.installer.dialog.dataPath || undefined,
    installerInfo: state.session.fomod.installer.dialog.info || undefined,
    installerState: state.session.fomod.installer.dialog.state || undefined,
  };
}

export default translate(['common'])(connect(mapStateToProps)(
  InstallerDialog)) as React.ComponentClass<IBaseProps>;
