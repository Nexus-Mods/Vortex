import * as React from 'react';
import { withTranslation } from 'react-i18next';
import { ComponentEx } from '../../../util/ComponentEx';

interface IProps {
  infoText: string;
}

class DefaultInfoPanel extends ComponentEx<IProps, {}> {
  constructor(props: IProps) {
    super(props);
    this.initState({});
  }

  public render() {
    const { t, infoText } = this.props;
    return (
      <div id='loadorderinfo'>
        <h2>{t('Changing your load order')}</h2>
        <p>{infoText}</p>
      </div>
    );
  }

}

export default withTranslation(['common'])
  ((DefaultInfoPanel) as any) as React.ComponentClass<{infoText: string}>;
