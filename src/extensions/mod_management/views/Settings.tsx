import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { Button } from '../../../views/TooltipControls';
import { setPath } from '../actions/settings';
import resolvePath from '../util/resolvePath';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup } from 'react-bootstrap';

import Icon = require('react-fontawesome');

interface IPaths {
  base: string;
  download: string;
  install: string;
}

interface IConnectedProps {
  paths: IPaths;
  gameMode: string;
}

interface IActionProps {
  onSetPath: (key: string, path: string) => void;
}

class Settings extends ComponentEx<IActionProps & IConnectedProps, {}> {
  public render(): JSX.Element {
    const { paths, t } = this.props;

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
          <HelpBlock>{ this.resolveInstall() }</HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private resolveBase = () => resolvePath('base', this.props.paths, this.props.gameMode);
  private resolveDownload = () => resolvePath('download', this.props.paths, this.props.gameMode);
  private resolveInstall = () => resolvePath('install', this.props.paths, this.props.gameMode);
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    paths: state.gameSettings.mods.paths,
    gameMode: state.settings.gameMode.current,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetPath: (key: string, path: string): void => {
      dispatch(setPath(key, path));
    },
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(Settings)
  ) as React.ComponentClass<{}>;
