import { II18NProps } from '../../../types/II18NProps';
import { Button } from '../../../views/TooltipControls';
import { setPath } from '../actions/settings';
import resolvePath from '../util/resolvePath';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

import Icon = require('react-fontawesome');

interface IPaths {
  base: string;
  download: string;
  install: string;
}

interface IConnectedProps {
  paths: IPaths;
  state: any;
}

interface IActionProps {
  onSetPath: (key: string, path: string) => void;
}

class Settings extends React.Component<IActionProps & IConnectedProps & II18NProps, {}> {
  public render(): JSX.Element {
    const { paths, t } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>Base Path</ControlLabel>
          <InputGroup>
            <FormControl value={paths.base} placeholder={ t('Base Path') } readOnly />
            <InputGroup.Button>
              <Button id='move-base-path' tooltip='Move'><Icon name='exchange' /></Button>
            </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{this.resolveBase() }</HelpBlock>

          <ControlLabel>Download Path</ControlLabel>
          <InputGroup>
          <FormControl value={paths.download} placeholder={ t('Download Path') } readOnly />
          <InputGroup.Button>
            <Button id='move-download-path' tooltip='Move'><Icon name='exchange' /></Button>
          </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{this.resolveDownload() }</HelpBlock>

          <ControlLabel>Install Path</ControlLabel>
          <InputGroup>
          <FormControl value={paths.install} placeholder={ t('Install Path') } readOnly />
          <InputGroup.Button>
            <Button id='move-install-path' tooltip='Move'><Icon name='exchange' /></Button>
          </InputGroup.Button>
          </InputGroup>
          <HelpBlock>{this.resolveInstall() }</HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private resolveBase = () => resolvePath('base', this.props.state);
  private resolveDownload = () => resolvePath('download', this.props.state);
  private resolveInstall = () => resolvePath('install', this.props.state);
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    paths: state.game_settings.mods.paths,
    state,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetPath: (key: string, path: string): void => {
      dispatch(setPath(key, path));
    },
  };
}

const SettingsTemp = connect(mapStateToProps, mapDispatchToProps)(Settings);

export default translate(['common'], { wait: true })(SettingsTemp);
