import { selectTheme } from './actions';
import { themeDir } from './util';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { ComponentEx } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';

interface IConnectedProps {
  currentTheme: string;
}

interface IActionProps {
  onSelectTheme: (theme: string) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  themes: string[];
}

class SettingsTheme extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      themes: [],
    });
  }

  public componentWillMount() {
    const baseDir = themeDir();
    // consider all directories in the theme directory as themes
    fs.readdirAsync(baseDir)
      .filter(fileName =>
        fs.statAsync(path.join(baseDir, fileName))
          .then(stat => stat.isDirectory()))
      .then(directories => {
        this.nextState.themes = directories
          .map(name => path.basename(name));
      });
  }

  public render(): JSX.Element {
    const { t, currentTheme } = this.props;
    return (
      <form>
        <FormGroup controlId='themeSelect'>
          <ControlLabel>{t('Theme')}</ControlLabel>
          <FormControl
            componentClass='select'
            onChange={this.selectTheme}
            value={currentTheme}
          >
            { this.renderTheme(null, t('default')) }
            { this.state.themes.map(theme => this.renderTheme(theme, theme)) }
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  public renderTheme(key: string, name: string) {
    return <option key={key} value={key}>{name}</option>;
  }

  private selectTheme = (evt) => {
    const theme = evt.currentTarget.value;
    console.log('select theme', theme);
    this.props.onSelectTheme(theme);
    this.context.api.events.emit('select-theme', theme);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentTheme: state.settings.interface.currentTheme,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSelectTheme: (theme: string) => dispatch(selectTheme(theme)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsTheme)) as React.ComponentClass<{}>;
