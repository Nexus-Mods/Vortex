import Advanced from '../../../controls/Advanced';
import { ButtonType } from '../../../controls/IconBar';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { setAddGameDialogVisible } from '../actions/session';

import * as I18next from 'i18next';
import * as React from 'react';

export interface IBaseProps {
  buttonType: ButtonType;
  showAddGameDialog: () => void;
  t: I18next.TranslationFunction;
}

class AddGameButton extends ComponentEx<IBaseProps, {}> {
  public render(): JSX.Element {
    const { t, buttonType, showAddGameDialog } = this.props;

    return (
      <Advanced>
        <ToolbarIcon
          id='add-game-manually'
          text={t('Add Game')}
          onClick={showAddGameDialog}
          icon='plus'
          buttonType={buttonType}
        />
      </Advanced>
    );
  }
}

export default
  translate(['common'], { wait: false })(
    connect()(
      AddGameButton)) as React.ComponentClass<IBaseProps>;
