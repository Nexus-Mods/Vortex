import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { TFunction } from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  buttonType: ButtonType;
  toggleHidden: () => void;
  showHidden: boolean;
  t: TFunction;
}

class ShowHiddenButton extends ComponentEx<IBaseProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType, showHidden, toggleHidden } = this.props;

    return (
      <ToolbarIcon
        id='show-hidden-games'
        text={showHidden ? t('Hide Hidden Games') : t('Show Hidden Games')}
        onClick={toggleHidden}
        icon={showHidden ? 'hide' : 'show'}
      />
    );
  }
}

export default
  translate(['common'])(
    connect()(
      ShowHiddenButton)) as React.ComponentClass<IBaseProps>;
