import { II18NProps } from '../../../types/II18NProps';
import { nativeCountryName, nativeLanguageName } from '../../../util/languagemap';
import { log } from '../../../util/log';
import { setLanguage } from '../actions/actions';

import { changeLanguage, language } from 'i18next';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import update = require('react-addons-update');

import { readdir } from 'fs';
import * as path from 'path';

interface ILanguage {
  key: string;
  language: string;
  country?: string;
}

interface IConnectedProps {
  currentLanguage: string;
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
}

interface IState {
  languages: ILanguage[];
}

class SettingsInterfaceBase extends React.Component<IActionProps & IConnectedProps & II18NProps, IState> {

  constructor(props) {
    super(props);

    this.state = {
      languages: [],
    };

    const localesPath = path.normalize(path.join(__dirname, '..', '..', '..', 'locales'));

    readdir(localesPath, (err, files) => {
      if (err) {
        log('warn', 'failed to read locales', err);
        return;
      }

      if (!('en' in files)) {
        files = files.concat(['en']);
      }

      log('info', 'files', files);

      const locales = files.map((key) => {
        let language = undefined;
        let country = undefined;

        if (key.includes('-')) {
          let [languageKey, countryKey] = key.split('-');
          language = nativeLanguageName(languageKey);
          country = nativeCountryName(countryKey);
        } else {
          language = nativeLanguageName(key);
        }
        return { key, language, country }; });

      log('info', 'locales', locales);

      this.setState(update(this.state, {
        languages: { $set: locales },
      }));
    });
  }

  public render(): JSX.Element {
    const { t, currentLanguage } = this.props;

    return (
      <form>
        <FormGroup controlId='languageSelect'>
          <ControlLabel>{t('Language') }</ControlLabel>
          <FormControl componentClass='select' onChange={this.selectLanguage} value={currentLanguage}>
            { this.state.languages.map((language) => { return this.renderLanguage(language); }) }
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private selectLanguage = (evt) => this.selectLanguageImpl(evt);

  private selectLanguageImpl(evt) {
    let target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.props.onSetLanguage(target.value);
  }

  private renderLanguage(language: ILanguage): JSX.Element {
    return (
      <option key={language.key} value={language.key}>
      { language.country === undefined ? language.language : `${language.language} (${language.country})` }
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
    onSetLanguage: (newLanguage: string): void => {
      changeLanguage(newLanguage, (err, t) => {
        if (err === undefined) {
          dispatch(setLanguage(newLanguage));
        } else {
          alert(err);
        }
      });
    },
  };
}

const SettingsInterface = connect(mapStateToProps, mapDispatchToProps)(SettingsInterfaceBase);

export default translate(['common'], { wait: true })(SettingsInterface);
