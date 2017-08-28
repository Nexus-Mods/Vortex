import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IExtensionContext } from '../../../types/IExtensionContext';
import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import DiagnosticsFilesDialogT from './DiagnosticsFilesDialog';
let DiagnosticsFilesDialog: typeof DiagnosticsFilesDialogT = Placeholder;

import * as update from 'immutability-helper';
import * as React from 'react';

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
  context: IExtensionContext;
}

interface IComponentState {
  dialogVisible: boolean;
}

type IProps = IBaseProps;

class DiagnosticsFilesButton extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public componentWillMount() {

    asyncRequire('./DiagnosticsFilesDialog', __dirname)
      .then(DiagnosticsFilesDialogIn => {
        DiagnosticsFilesDialog = DiagnosticsFilesDialogIn.default;
        this.forceUpdate();
      });
  }

  public render(): JSX.Element {
    const { t, buttonType, context } = this.props;
    const { dialogVisible } = this.state;

    return (
      <ToolbarIcon
        id='diagnostics-files-btn'
        icon='bug'
        text={t('Diagnostics Files')}
        placement='top'
        onClick={this.showDiagnosticsFilesLayer}
        buttonType={buttonType}
      >
        <DiagnosticsFilesDialog
          shown={dialogVisible}
          onHide={this.hideDiagnosticsFilesLayer}
          context={context}
        />
      </ToolbarIcon>
    );
  }

  private showDiagnosticsFilesLayer = () => {
    this.setDialogVisible(true);
  }

  private hideDiagnosticsFilesLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.setState(update(this.state, {
      dialogVisible: { $set: visible },
    }));
  }
}

export default
  translate(['common'], { wait: false })(DiagnosticsFilesButton) as React.ComponentClass<{}>;
