import { setDialogVisible } from '../../../actions/session';

import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IExtensionContext } from '../../../types/IExtensionContext';
import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import * as update from 'immutability-helper';
import * as React from 'react';
import * as Redux from 'redux';

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
}

interface IComponentState {
  dialogVisible: boolean;
}

interface IActionProps {
  onShowDialog: () => void;
}

type IProps = IBaseProps & IActionProps;

class DiagnosticsFilesButton extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
      <ToolbarIcon
        id='diagnostics-files-btn'
        icon='bug'
        text={t('Diagnostics Files')}
        placement='top'
        onClick={this.showDiagnosticsFilesLayer}
        buttonType={buttonType}
      />
    );
  }

  private showDiagnosticsFilesLayer = () => {
    this.setDialogVisible(true);
  }

  private hideDiagnosticsFilesLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.props.onShowDialog();
  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: () => dispatch(setDialogVisible('diagnostics-files-dialog')),
  };
}

export default connect(null, mapDispatchToProps)(
  translate(['common'], { wait: false })
    (DiagnosticsFilesButton)) as React.ComponentClass<{ IBaseProps }>;
