import { II18NProps } from '../../../types/II18NProps';
import { setLanguage } from '../actions/actions';

import { changeLanguage } from 'i18next';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface ILanguage {
  key: string;
  name: string;
}

interface IConnectedProps {
  currentLanguage: string;
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
}

class SettingsInterfaceBase extends React.Component<IActionProps & IConnectedProps & II18NProps, {}> {
  private selectLanguage: (event) => void;

  constructor(props) {
    super(props);

    this.selectLanguage = this.selectLanguageImpl.bind(this);
  }

  public render(): JSX.Element {
    const { t, currentLanguage } = this.props;

    const languages = [
      { key: 'en-GB', name: 'English' },
      { key: 'de', name: 'Deutsch' },
      { key: 'it', name: 'italiano' },
      { key: 'jp', name: '日本語' },
    ];

    return (
      <form>
        <FormGroup controlId='languageSelect'>
          <ControlLabel>{t('Language') }</ControlLabel>
          <FormControl componentClass='select' onChange={this.selectLanguage} value={currentLanguage}>
            { languages.map((language) => { return this.renderLanguage(language); }) }
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private selectLanguageImpl(evt) {
    let target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.props.onSetLanguage(target.value);
  }

  private renderLanguage(language: ILanguage): JSX.Element {
    return (
      <option key={language.key} value={language.key}>
        {language.name}
      </option>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentLanguage: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetLanguage: (language: string) => {
      changeLanguage(language);
      return dispatch(setLanguage(language));
    },
  };
}

const SettingsInterface = connect(mapStateToProps, mapDispatchToProps)(SettingsInterfaceBase);

export default translate(['common'], { wait: true })(SettingsInterface);
