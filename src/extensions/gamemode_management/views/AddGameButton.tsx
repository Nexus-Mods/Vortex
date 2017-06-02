import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import Advanced from '../../../views/Advanced';
import { ButtonType } from '../../../views/IconBar';
import ToolbarIcon from '../../../views/ToolbarIcon';

import { setAddGameDialogVisible } from '../actions/session';

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
