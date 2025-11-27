import { selectTheme } from './actions';
import ThemeEditor from './ThemeEditor';

import * as React from 'react';
import { Alert, Button, ControlLabel, FormControl, FormGroup, InputGroup } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { actions, ComponentEx, log, tooltip, types, util } from 'vortex-api';

export interface ISettingsThemeProps {
  readThemes: () => Promise<string[]>;
  onCloneTheme: (themeName: string, newName: string) => Promise<void>;
  onSelectTheme: (themeName: string) => void;
  onSaveTheme: (themeName: string, variables: { [name: string]: string }) => Promise<void>;
  onRemoveTheme: (themeName: string) => Promise<void>;
  readThemeVariables: (themeName: string) => Promise<{ [key: string]: string }>;
  locationToName: (location: string) => string;
  nameToLocation: (name: string) => string;
  isThemeCustom: (themeName: string) => boolean;
  onEditStyle: (themeName: string) => void;
  getAvailableFonts: () => Promise<string[]>;
}

interface IConnectedProps {
  currentTheme: string;
}

interface IActionProps {
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions,
  ) => Promise<types.IDialogResult>;
  onShowError: (title: string, details: any) => void;
}

type IWrapperProps = ISettingsThemeProps & IConnectedProps & IActionProps;
type IProps = Omit<ISettingsThemeProps, "readThemes"> & { themes: string[] } & IConnectedProps & IActionProps;

interface IComponentState {
  availableFonts: string[];
  variables: { [key: string]: string };
  editable: boolean;
}

class SettingsTheme extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      availableFonts: [],
      variables: {},
      editable: false,
    });
  }

  public UNSAFE_componentWillMount() {
    this.nextState.availableFonts = Array.from(new Set<string>(
      [
        'Inter',
        'Roboto',
        'BebasNeue',
        'Montserrat',
      ]));

    this.nextState.editable = this.isCustom(this.props.currentTheme);
    return this.updateVariables(this.props.currentTheme);
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.currentTheme !== newProps.currentTheme) {
      this.updateVariables(newProps.currentTheme);
      this.nextState.editable = this.isCustom(newProps.currentTheme);
    }
  }

  public render(): JSX.Element {
    const { t, currentTheme, themes } = this.props;
    const { editable, variables } = this.state;
    return (
      <div style={{ position: 'relative' }}>
        <form>
          <FormGroup controlId='themeSelect'>
            <ControlLabel>{t('Theme')}</ControlLabel>
            <InputGroup style={{ width: 300 }}>
              <FormControl
                componentClass='select'
                onChange={this.selectTheme}
                value={currentTheme}
              >
                {themes.map(iter => {
                  const theme = this.props.locationToName(iter);
                  return this.renderTheme(theme, theme);
                })}
              </FormControl>
              <InputGroup.Button>
                <Button bsStyle='primary' onClick={this.onClone} >{t('Clone')}</Button>
                {editable
                  ? <Button bsStyle='primary' onClick={this.remove}>{t('Remove')}</Button>
                  : null}
              </InputGroup.Button>
            </InputGroup>
            {editable ? null : (
              <Alert bsStyle='info'>
                {t('Please clone this theme to modify it.')}
              </Alert>
            )}
          </FormGroup>
        </form>
        <ThemeEditor
          t={t}
          themeName={currentTheme}
          theme={variables}
          onApply={this.saveTheme}
          disabled={!editable}
          onEditStyle={this.props.onEditStyle}
          getAvailableFonts={this.props.getAvailableFonts}
        />
        {editable
          ? (
            <tooltip.IconButton
              style={{ position: 'absolute', top: 20, right: 20 }}
              className='btn-embed'
              icon='refresh'
              tooltip={t('Reload')}
              onClick={this.refresh}
            />
          ) : null}
      </div>
    );
  }

  public renderTheme(key: string, name: string) {
    return <option key={key} value={key}>{name}</option>;
  }

  private refresh = () => {
    const { currentTheme } = this.props;
    this.props.onSelectTheme(currentTheme);
  }

  private saveTheme = (variables: { [name: string]: string }) => {
    const { currentTheme, onSaveTheme } = this.props;
    onSaveTheme(currentTheme, variables);
  }

  private async updateVariables(themeName: string) {
    this.nextState.variables = await this.props.readThemeVariables(themeName);
  }

  private onClone = () => {
    this.cloneTheme(this.props.currentTheme, this.props.themes);
  }

  private cloneTheme(themeName: string, themes: string[], error?: string) {
    const { t, onCloneTheme } = this.props;

    // note: In the past we used proper name normalization based on the file system themes are stored on,
    //   meaning that on a case-sensitive file system (linux), we would have allowed two themes to be named
    //   "same" and "SAME".
    //   I don't feel like that's actually desireable - much less worth making the code more complex over
    const existing = new Set(themes.map(theme => this.props.locationToName(theme).toUpperCase()));

    return this.props.onShowDialog('question', 'Enter a name', {
      bbcode: error !== undefined ? `[color=red]${t(error)}[/color]` : undefined,
      input: [{
        id: 'name',
        placeholder: 'Theme Name',
        value: themeName !== '__default' ? themeName : '',
      }],
      condition: (content: types.IDialogContent) => {
        const res: types.IConditionResult[] = [];
        const { value } = content.input?.[0] ?? {};
        if ((value !== undefined) && (existing.has(value.toUpperCase()))) {
          res.push({
            id: 'name',
            errorText: 'Name already used',
            actions: ['Clone'],
          });
        }
        if ((value !== undefined) && !util.isFilenameValid(value)) {
          res.push({
            id: 'name',
            errorText: 'Invalid symbols in name',
            actions: ['Clone'],
          });
        }
        return res;
      },
    }, [{ label: 'Cancel' }, { label: 'Clone' }])
      .then(res => {
        if (res.action === 'Clone') {
          return onCloneTheme(themeName, res.input.name);
        }
        return Promise.resolve();
      })
      .catch(err => {
        if (err instanceof util.ArgumentInvalid) {
          return this.cloneTheme(themeName, themes, err.message);
        }
        this.props.onShowError('Failed to clone theme', err);
      });
  }

  private remove = () => {
    const { t, currentTheme, onShowDialog } = this.props;
    log('info', 'removing theme', currentTheme);
    if (!currentTheme || !this.isCustom(currentTheme)) {
      throw new Error('invalid theme');
    }
    onShowDialog('question', t('Confirm removal'), {
      text: t('Are you sure you want to remove the theme "{{theme}}"', {
        replace: { theme: currentTheme },
      }),
    }, [
      { label: 'Cancel' },
      {
        label: 'Confirm',
        action: () => {
          this.props.onRemoveTheme(currentTheme);
        },
      },
    ]);
  }

  private selectTheme = (evt) => {
    this.context.api.events.emit('analytics-track-click-event', 'Themes', 'Select theme');
    this.props.onSelectTheme(evt.currentTarget.value);
  }

  private isCustom = (themeName: string): boolean => {
    return this.props.isThemeCustom(themeName);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentTheme: state.settings.interface.currentTheme,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, any, Redux.Action>): IActionProps {
  return {
    onShowError: (title: string, details: any) => util.showError(dispatch, title, details),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
  };
}

function SettingsThemeWrapper(props: IWrapperProps) {
  const [themes, setThemes] = React.useState<string[]>(undefined);

  React.useEffect(() => {
    (async () => {
      const result = await props.readThemes();
      setThemes(result);
    })();
  }, []);

  if (themes !== undefined) {
    return <SettingsTheme {...props} themes={themes} />
  }

  return null;
}

export default
  withTranslation(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsThemeWrapper)) as React.ComponentClass<ISettingsThemeProps>;
