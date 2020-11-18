import * as React from 'react';
import { withTranslation } from 'react-i18next';
import { ComponentEx } from 'vortex-api';
import { FlexLayout } from '../../../controls/api';

import bbcode from '../../../util/bbcode';

import { LoadOrderValidationError } from '../types/types';

interface IProps {
  infoText: string;
  validationError: LoadOrderValidationError;
}

class InfoPanel extends ComponentEx<IProps, {}> {
  private mDefaultInfo: string;
  constructor(props: IProps) {
    super(props);
    this.mDefaultInfo = 'Drag and drop your load order entries around to modify the order in which the game loads your mods.';
  }
  public render() {
    const { t, infoText } = this.props;
    const text = (infoText !== undefined)
      ? infoText
      : this.mDefaultInfo;
    return (
      <div id='loadorderinfo'>
        <FlexLayout type='column'>
          <FlexLayout.Flex>
            <h2>{t('Changing your load order')}</h2>
            <p>{bbcode(t(text))}</p>
          </FlexLayout.Flex>
          <FlexLayout.Flex>
            {this.renderErrorBox()}
          </FlexLayout.Flex>
        </FlexLayout>
      </div>
    );
  }

  private renderErrorBox() {
    const { t } = this.props;
    const { validationError } = this.props;
    const title = t('Validation Error Console:');
    let errorText = t('No validation errors.');
    if (validationError !== undefined) {
      errorText = t(validationError.message + ':[br][/br]' + '{{invalid}}', {
        replace: {
          invalid: validationError.validationResult.invalid.map(invl =>
            `${invl.id} - ${invl.reason}`).join('[br][/br]'),
        },
      });
    }

    return (
      <div style={{ height: '100%', width: '100%' }}>
        <h5>{title}</h5>
        <div id='fb-lo-errorbox'>
          <p>{bbcode(errorText)}</p>
        </div>
      </div>
    );
  }
}

export default withTranslation(['common'])
  ((InfoPanel) as any) as React.ComponentClass<{
    validationError: LoadOrderValidationError,
    infoText: string}>;
