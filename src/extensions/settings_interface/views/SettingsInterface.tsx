import { II18NProps } from '../../../types/II18NProps';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';

interface ILanguage {
  key: string;
  name: string;
}

class SettingsInterface extends React.Component<II18NProps, {}> {

  public render(): JSX.Element {
    const { t } = this.props;

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
          <FormControl componentClass='select'>
            { languages.map((language) => { return this.renderLanguage(language); }) }
          </FormControl>
        </FormGroup>
      </form>
    );
  }

  private renderLanguage(language: ILanguage): JSX.Element {
    return (
      <option key={language.key} value={language.key}>
        {language.name}
      </option>
    );
  }
}

export default translate(['common'], { wait: true })(SettingsInterface);
