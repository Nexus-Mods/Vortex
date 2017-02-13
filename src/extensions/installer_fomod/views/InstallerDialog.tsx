import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import {pushSafe, removeValue} from '../../../util/storeHelper';
import {IconButton} from '../../../views/TooltipControls';

import {GroupType, IGroup, IHeaderImage, IInstallStep, IInstallerState,
        IPlugin, OrderType} from '../types/interface';

import * as path from 'path';
import * as React from 'react';
import update = require('react-addons-update');
import { Checkbox, ControlLabel, Form, FormGroup, Modal, Pager,
         ProgressBar, Radio } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

interface IPluginProps {
  plugin: IPlugin;
  onShowDescription: (image: string, description: string) => void;
}

class Plugin extends React.PureComponent<IPluginProps, {}> {
  public render(): JSX.Element {
    const {plugin} = this.props;
    return (<div className='fomod-plugin-item'>
      {plugin.name}
    </div>);
  }
}

interface IGroupProps {
  group: IGroup;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
};

interface IGroupState {
  selectedPlugins: number[];
}

class Group extends React.PureComponent<IGroupProps, IGroupState> {
  constructor(props: IGroupProps) {
    super(props);
    this.state = {
      selectedPlugins: [],
    };
  }

  public componentDidUpdate() {
    const {group, onSelect} = this.props;
    const {selectedPlugins} = this.state;
    const valid = this.validateFunc(group.type)(selectedPlugins);
    onSelect(group.id, this.state.selectedPlugins, valid);
  }

  public render(): JSX.Element {
    const {group} = this.props;
    const {selectedPlugins} = this.state;

    const validationState = this.validateFunc(group.type)(selectedPlugins) ? null : 'error';

    return (<FormGroup validationState={validationState}>
      <ControlLabel>
        {group.name}
      </ControlLabel>
      { group.options.map(this.renderPlugin)}
    </FormGroup>);
  }

  private validateFunc(type: GroupType) {
    switch (type) {
      case 'SelectAtLeastOne': return (selected: number[]) => selected.length > 0;
      case 'SelectAtMostOne': return (selected: number[]) => selected.length < 2;
      case 'SelectExactlyOne': return (selected: number[]) => selected.length === 1;
      default: return () => true;
    }
  }

  private renderPlugin = (plugin: IPlugin): JSX.Element => {
    const {group, onShowDescription} = this.props;
    const {selectedPlugins} = this.state;
    const inner = <Plugin key={plugin.id} plugin={plugin} onShowDescription={onShowDescription}/>;

    const isSelected = selectedPlugins.indexOf(plugin.id) !== -1;

    switch (group.type) {
      case 'SelectExactlyOne':
        return <Radio
          id={`radio-${group.id}-${plugin.id}`}
          key={plugin.id}
          value={plugin.id}
          name={group.id.toString()}
          checked={isSelected}
          onChange={this.select}
        >{inner}
        </Radio>;
      case 'SelectAll': return inner;
      default: return <Checkbox
        id={`checkbox-${group.id}-${plugin.id}`}
        key={plugin.id}
        value={plugin.id}
        checked={isSelected}
        onChange={this.select}
      >{inner}
      </Checkbox>;
    }
  }

  private select = (evt: React.FormEvent<any>) => {
    const {group, onShowDescription} = this.props;
    const pluginId = parseInt(evt.currentTarget.value, 10);

    const {image, description} = group.options[pluginId];
    onShowDescription(image, description);

    if (group.type === 'SelectExactlyOne') {
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
  step: IInstallStep;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (image: string, description: string) => void;
};

function Step(props: IStepProps) {
  let groupsSorted: IGroup[];
  if (props.step.optionalFileGroups.group === undefined) {
    return null;
  }
  if (props.step.optionalFileGroups.order === 'Explicit') {
    groupsSorted = props.step.optionalFileGroups.group;
  } else {
    let sortFunc = getGroupSortFunc(props.step.optionalFileGroups.order);
    groupsSorted = props.step.optionalFileGroups.group.sort(sortFunc);
  }

  return <Form id='fomod-installer-form'>
    {groupsSorted.map((group: IGroup) =>
      <Group
        key={group.id}
        group={group}
        onSelect={props.onSelect}
        onShowDescription={props.onShowDescription}
      />)}
  </Form>;
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

class InstallerDialog extends ComponentEx<IProps, IDialogState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      invalidGroups: [],
      currentImage: undefined,
      currentDescription: undefined,
    };
  }

  public componentWillReceiveProps(nextProps: IProps) {
    this.setState({
      invalidGroups: [],
      currentImage: undefined,
      currentDescription: undefined,
    });
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
          <ProgressBar now={idx} max={steps.length} />
        </Modal.Header>
        <Modal.Body>
          <Layout type='row' style={{ position: 'relative' }}>
            <Flex>
              <Step
                step={steps[idx]}
                onSelect={this.select}
                onShowDescription={this.showDescription}
              />
            </Flex>
            <Fixed style={{ maxWidth: '60%' }}>
              { this.renderImage() }
              <ControlLabel readOnly={true}>{currentDescription}</ControlLabel>
            </Fixed>
          </Layout>
        </Modal.Body>
        <Modal.Footer>
          <Pager>
            {lastVisible !== undefined
              ? <Pager.Item previous onClick={this.prev}>{lastVisible.name}</Pager.Item>
              : null}
            {
              nextVisible !== undefined
                ? <Pager.Item next disabled={nextDisabled} onClick={this.next}>
                  {nextVisible.name}
                </Pager.Item>
                : <Pager.Item next disabled={nextDisabled} onClick={this.next}>
                  {t('Finish')}
                </Pager.Item>
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
  };

  private renderImage = () => {
    const { dataPath } = this.props;
    const { currentImage } = this.state;

    if ((currentImage === undefined) || (currentImage === null)) {
      return null;
    }

    return (<img
        src={path.join(dataPath, currentImage)}
        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
    />);
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
  InstallerDialog
  )
 ) as React.ComponentClass<IBaseProps>;
