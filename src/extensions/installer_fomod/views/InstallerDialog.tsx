import { connect, PureComponentEx, translate } from '../../../util/ComponentEx';
import {pushSafe, removeValue} from '../../../util/storeHelper';
import {IconButton} from '../../../views/TooltipControls';

import {GroupType, IGroup, IHeaderImage, IInstallerState, IInstallStep,
        IPlugin, OrderType} from '../types/interface';

import * as update from 'immutability-helper';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Checkbox, ControlLabel, Form, FormGroup, Modal, Pager,
         ProgressBar, Radio } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

interface IGroupProps {
  t: I18next.TranslationFunction;
  stepId: number;
  group: IGroup;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
}

interface IGroupState {
  selectedPlugins: number[];
}

class Group extends React.PureComponent<IGroupProps, IGroupState> {
  constructor(props: IGroupProps) {
    super(props);
    this.state = {
      selectedPlugins: this.getSelectedPlugins(props),
    };
  }

  public componentDidUpdate(oldProps: IGroupProps, oldState: IGroupState) {
    const {group, onSelect} = this.props;
    const {selectedPlugins} = this.state;
    const valid = this.validateFunc(group.type)(selectedPlugins);
    if (selectedPlugins !== oldState.selectedPlugins) {
      onSelect(group.id, selectedPlugins, valid);
    }
  }

  public componentWillReceiveProps(newProps: IGroupProps) {
    if (!_.isEqual(this.props.group, newProps.group)) {
      this.setState({ selectedPlugins: this.getSelectedPlugins(newProps) });
    }
  }

  public render(): JSX.Element {
    const {group} = this.props;
    const {selectedPlugins} = this.state;

    const validationState = this.validateFunc(group.type)(selectedPlugins) ? null : 'error';

    return (
      <FormGroup validationState={validationState}>
        <ControlLabel>
          {group.name}
        </ControlLabel>
        {this.renderNoneOption()}
        {group.options.map(this.renderPlugin)}
      </FormGroup>
    );
  }

  private getSelectedPlugins(props: IGroupProps) {
    return props.group.options
      .filter((plugin) => plugin.selected)
      .map((plugin) => plugin.id);
  }

  private validateFunc(type: GroupType) {
    switch (type) {
      case 'SelectAtLeastOne': return (selected: number[]) => selected.length > 0;
      case 'SelectAtMostOne': return (selected: number[]) => selected.length < 2;
      case 'SelectExactlyOne': return (selected: number[]) => selected.length === 1;
      default: return () => true;
    }
  }

  private renderNoneOption = (): JSX.Element => {
    const {t, group, stepId} = this.props;
    const {selectedPlugins} = this.state;

    if (group.type !== 'SelectAtMostOne') {
      return null;
    }

    const isSelected = selectedPlugins.length === 0;
    return (
      <Radio
        id={`radio-${stepId}-${group.id}-none`}
        key='none'
        name={group.id.toString()}
        value='none'
        checked={isSelected}
        onChange={this.select}
      >{t('None')}
      </Radio>
    );
  }

  private renderPlugin = (plugin: IPlugin): JSX.Element => {
    const {group, stepId} = this.props;
    const {selectedPlugins} = this.state;

    const isSelected = selectedPlugins.indexOf(plugin.id) !== -1;
    const id = `${stepId}-${group.id}-${plugin.id}`;

    switch (group.type) {
      case 'SelectExactlyOne':
      case 'SelectAtMostOne':
        return (
          <Radio
            id={'radio-' + id}
            key={plugin.id}
            value={plugin.id}
            name={group.id.toString()}
            checked={isSelected}
            onChange={this.select}
          >{plugin.name}
          </Radio>
        );
      case 'SelectAll':
        return (
          <Checkbox
            id={'checkbox-' + id}
            key={plugin.id}
            checked={true}
            readOnly={true}
            value={plugin.id}
            onClick={this.showDescription}
          >{plugin.name}
          </Checkbox>
        );
      default:
        return (
          <Checkbox
            id={'checkbox-' + id}
            key={plugin.id}
            value={plugin.id}
            checked={isSelected}
            onChange={this.select}
          >{plugin.name}
          </Checkbox>
        );
    }
  }

  private showDescription = (evt: React.FormEvent<any>) => {
    const {group, onShowDescription} = this.props;

    const pluginId = parseInt(evt.currentTarget.value, 10);
    const {image, description} = group.options[pluginId];

    onShowDescription(image, description);
  }

  private select = (evt: React.FormEvent<any>) => {
    const {group} = this.props;

    if (evt.currentTarget.value === 'none') {
      this.setState({ selectedPlugins: [] });
      return;
    }

    const pluginId = parseInt(evt.currentTarget.value, 10);

    this.showDescription(evt);

    if (['SelectExactlyOne', 'SelectAtMostOne'].indexOf(group.type) !== -1) {
      this.setState({ selectedPlugins: [pluginId] });
    } else if (this.state.selectedPlugins.indexOf(pluginId) === -1) {
      this.setState(pushSafe(this.state, ['selectedPlugins'], pluginId));
    } else {
      this.setState(removeValue(this.state, ['selectedPlugins'], pluginId));
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
  t: I18next.TranslationFunction;
  step: IInstallStep;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
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
    groupsSorted = props.step.optionalFileGroups.group.sort(sortFunc);
  }

  return (
    <Form id='fomod-installer-form'>
      {groupsSorted.map((group: IGroup) => (
        <Group
          t={props.t}
          key={`${props.step.id}-${group.id}`}
          stepId={props.step.id}
          group={group}
          onSelect={props.onSelect}
          onShowDescription={props.onShowDescription}
        />))}
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
interface ISize {
  width: number;
  height: number;
}
interface IDialogState {
  invalidGroups: string[];
  currentImage: string;
  currentDescription: string;
}
type IProps = IBaseProps & IConnectedProps;
class InstallerDialog extends PureComponentEx<IProps, IDialogState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      invalidGroups: [],
      currentImage: undefined,
      currentDescription: undefined,
    };
  }
  public componentWillReceiveProps(nextProps: IProps) {
    if ((this.props.installerState !== undefined) &&
      ((this.props.installerInfo !== nextProps.installerInfo)
        || (this.props.installerState.currentStep !== nextProps.installerState.currentStep))) {
      this.setState({
        invalidGroups: [],
        currentImage: undefined,
        currentDescription: undefined,
      });
    }
  }
  public render(): JSX.Element {
    const { t, installerInfo, installerState } = this.props;
    const { currentDescription } = this.state;
    if ((installerInfo === undefined) || (installerState === undefined)) {
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
          <h3>{installerInfo.moduleName}</h3>
          <IconButton
            id='fomod-cancel'
            className='close-button'
            tooltip={t('Cancel')}
            icon='remove'
            onClick={this.cancel}
          />
        </Modal.Header>
        <Modal.Body>
          <Layout type='row' style={{ position: 'relative' }}>
            <Flex style={{ overflowY: 'auto' }}>
              <Step
                t={t}
                step={steps[idx]}
                onSelect={this.select}
                onShowDescription={this.showDescription}
              />
            </Flex>
            <Fixed style={{ maxWidth: '60%', overflowY: 'auto' }}>
              { this.renderImage() }
              <ControlLabel readOnly={true}>{currentDescription}</ControlLabel>
            </Fixed>
          </Layout>
        </Modal.Body>
        <Modal.Footer>
          <Pager>
            {
              lastVisible !== undefined
                ? <Pager.Item previous onClick={this.prev}>{lastVisible.name}</Pager.Item>
                : null
            }
            <li>
              <ProgressBar now={idx} max={steps.length} />
            </li>
            {
              nextVisible !== undefined
                ? (
                  <Pager.Item next disabled={nextDisabled} onClick={this.next}>
                    {nextVisible.name}
                  </Pager.Item>
                ) : (
                  <Pager.Item next disabled={nextDisabled} onClick={this.next}>
                    {t('Finish')}
                  </Pager.Item>
                )
            }
          </Pager>
        </Modal.Footer>
      </Modal>
    );
  }
  private nop = () => undefined;
  private select = (groupId: number, plugins: number[], valid: boolean) => {
    const {events} = this.context.api;
    const {installerState} = this.props;
    if (valid) {
      this.setState(removeValue(this.state, ['invalidGroups'], groupId));
      events.emit('fomod-installer-select',
        installerState.installSteps[installerState.currentStep].id, groupId, plugins);
    } else {
      this.setState(pushSafe(this.state, ['invalidGroups'], groupId));
    }
  }
  private renderImage = () => {
    const { dataPath } = this.props;
    const { currentImage } = this.state;
    if ((currentImage === undefined) || (currentImage === null)
        || (dataPath === undefined) || (dataPath === null)) {
      return null;
    }
    return (
      <img
        src={path.join(dataPath, currentImage)}
        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
      />
    );
  }
  private showDescription = (image: string, description: string) => {
    this.setState(update(this.state, {
      currentDescription: { $set: description },
      currentImage: { $set: image },
    }));
  }
  private prev = () => this.context.api.events.emit('fomod-installer-continue', 'back');
  private next = () => this.context.api.events.emit('fomod-installer-continue', 'forward');
  private cancel = () => this.context.api.events.emit('fomod-installer-cancel');
}
function mapStateToProps(state: any): IConnectedProps {
  return {
    dataPath: state.session.fomod.installer.dialog.dataPath,
    installerInfo: state.session.fomod.installer.dialog.info,
    installerState: state.session.fomod.installer.dialog.state,
  };
}
export default translate(['common'], { wait: false })(connect(mapStateToProps)(
  InstallerDialog)) as React.ComponentClass<IBaseProps>;
