import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { Button } from '../../../views/TooltipControls';
import { setActivator, setPath } from '../actions/settings';
import { IModActivator } from '../types/IModActivator';
import resolvePath from '../util/resolvePath';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup } from 'react-bootstrap';

import Icon = require('react-fontawesome');

import { log } from '../../../util/log';

interface IPaths {
  base: string;
  download: string;
  install: string;
}

interface IBaseProps {
  activators: IModActivator[];
}

interface IConnectedProps {
  paths: IPaths;
  gameMode: string;

  currentActivator: string;
}

interface IActionProps {
  onSetPath: (key: string, path: string) => void;
  onSetActivator: (id: string) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { currentActivator, activators, paths, t } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>{ t('Base Path') }</ControlLabel>
          <InputGroup>
            <FormControl value={paths.base} placeholder={ t('Base Path') } readOnly />
            <InputGroup.Button>
              <Button id='move-base-path' tooltip={ t('Move') }><Icon name='exchange' /></Button>
            </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{ this.resolveBase() }</HelpBlock>

          <ControlLabel>{ t('Download Path') }</ControlLabel>
          <InputGroup>
          <FormControl value={paths.download} placeholder={ t('Download Path') } readOnly />
          <InputGroup.Button>
            <Button id='move-download-path' tooltip={ t('Move') }><Icon name='exchange' /></Button>
          </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{ this.resolveDownload() }</HelpBlock>

          <ControlLabel>{ t('Install Path') }</ControlLabel>
          <InputGroup>
          <FormControl value={paths.install} placeholder={ t('Install Path') } readOnly />
          <InputGroup.Button>
            <Button id='move-install-path' tooltip={ t('Move') }><Icon name='exchange' /></Button>
          </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{this.resolveInstall()}</HelpBlock>
        </FormGroup>
        <ControlLabel>Activation Method</ControlLabel>
        <FormGroup validationState={ activators !== undefined ? undefined : 'error' }>
          { this.renderActivators(activators, currentActivator) }
        </FormGroup>
      </form>
    );
  }

  private renderActivators(activators: IModActivator[], currentActivator: string): JSX.Element {
    const { t } = this.props;

    if ((activators !== undefined) && (activators.length > 0)) {
      let activatorIdx: number = 0;
      if (currentActivator !== undefined) {
        activatorIdx = activators.findIndex((activator) => activator.id === currentActivator);
      }
      return (
        <div>
        <FormControl
          componentClass='select'
          value={currentActivator}
          onChange={this.selectActivator}
        >
          {activators.map(this.renderActivatorOption)}
        </FormControl>
        <HelpBlock>
          {activators[activatorIdx].description}
        </HelpBlock>
        </div>
      );
    } else {
      return <ControlLabel>{ t('No mod activators installed') }</ControlLabel>;
    }
  }

  private renderActivatorOption(activator: IModActivator): JSX.Element {
    return (
      <option key={activator.id} value={activator.id}>{activator.name}</option>
    );
  }

  private selectActivator = (evt) => {
    let target: HTMLSelectElement = evt.target as HTMLSelectElement;
    log('info', 'select activator', { id: target.value });
    this.props.onSetActivator(target.value);
  }

  private resolveBase = () => resolvePath('base', this.props.paths, this.props.gameMode);
  private resolveDownload = () => resolvePath('download', this.props.paths, this.props.gameMode);
  private resolveInstall = () => resolvePath('install', this.props.paths, this.props.gameMode);
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    paths: state.gameSettings.mods.paths,
    gameMode: state.settings.gameMode.current,
    currentActivator: state.gameSettings.mods.activator,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetPath: (key: string, path: string): void => {
      dispatch(setPath(key, path));
    },
    onSetActivator: (id: string): void => {
      dispatch(setActivator(id));
    },
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(Settings)
  ) as React.ComponentClass<{}>;
