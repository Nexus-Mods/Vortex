import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  toggleInstalledOnly: () => void;
  showInstalledOnly: boolean;
  t: TFunction;
}

class InstalledOnlyButton extends ComponentEx<IBaseProps, {}> {
  public render(): JSX.Element {
    const { t, showInstalledOnly, toggleInstalledOnly } = this.props;

    return (
      <ToolbarIcon
        id='btn-toggle-installed-only'
        text={showInstalledOnly ? t('Show All Games') : t('Installed Only')}
        onClick={toggleInstalledOnly}
        icon={showInstalledOnly ? 'feedback-success' : 'install'}
      />
    );
  }
}

export default
  translate(['common'])(
    connect()(
      InstalledOnlyButton)) as React.ComponentClass<IBaseProps>;