import * as React from 'react';
import { withTranslation } from 'react-i18next';
import FlexLayout from '../../../controls/FlexLayout';
import bbcode from '../../../util/bbcode';
import { ComponentEx } from '../../../util/ComponentEx';
import { LoadOrderValidationError } from '../types/types';

interface IProps {
  info: string | React.ComponentType<{}>;
  validationError: LoadOrderValidationError;
}

class InfoPanel extends ComponentEx<IProps, {}> {
  private mDefaultInfo: string;
  constructor(props: IProps) {
    super(props);
    this.mDefaultInfo = 'Drag and drop your load order entries around to modify the order in which the game loads your mods.';
  }
  public render() {
    const { t, info } = this.props;

    const Info = info;
    const panel = (info === undefined)
      ? bbcode(t(this.mDefaultInfo))
      : typeof(info) === 'string'
        ? bbcode(t(info))
        : <Info />;

    return (
      <div id='loadorderinfo'>
        <FlexLayout type='column'>
          <FlexLayout.Flex>
            <h2>{t('Changing your load order')}</h2>
            {panel}
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
    const classname = validationError === undefined ? 'valid' : 'invalid';
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
      <>
        <h5>{title}</h5>
        <div className={classname} id='fb-lo-errorbox'>
          <p>{bbcode(errorText)}</p>
        </div>
      </>
    );
  }
}

export default withTranslation(['common'])
  ((InfoPanel) as any) as React.ComponentClass<{
    validationError: LoadOrderValidationError,
    info: string | React.ComponentType<{}>}>;
