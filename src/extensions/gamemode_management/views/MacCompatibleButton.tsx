import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  toggleMacCompatible: () => void;
  showMacCompatibleOnly: boolean;
  t: TFunction;
}

class MacCompatibleButton extends ComponentEx<IBaseProps, {}> {
  public render(): JSX.Element {
    const { t, showMacCompatibleOnly, toggleMacCompatible } = this.props;

    return (
      <ToolbarIcon
        id='show-mac-compatible-games'
        text={showMacCompatibleOnly ? t('Show All Games') : t('Mac Compatible Only')}
        onClick={toggleMacCompatible}
        icon={showMacCompatibleOnly ? 'feedback-success' : 'apple'}
      />
    );
  }
}

export default
  translate(['common'])(
    connect()(
      MacCompatibleButton)) as React.ComponentClass<IBaseProps>;