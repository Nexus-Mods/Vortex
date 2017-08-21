import ToolbarIcon from '../../../controls/ToolbarIcon';
import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import DiagnosticsFilesDialogT from './DiagnosticsFilesDialog';
let DiagnosticsFilesDialog: typeof DiagnosticsFilesDialogT = Placeholder;

import * as update from 'immutability-helper';
import * as React from 'react';

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
}

interface IComponentState {
  dialogVisible: boolean;
}

type IProps = IBaseProps;

class DiagnosticsFilesButton extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean = false;
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public componentWillMount() {
    this.mIsMounted = true;
    asyncRequire('./DiagnosticsFilesDialog', __dirname)
    .then(DiagnosticsFilesDialogIn => {
      DiagnosticsFilesDialog = DiagnosticsFilesDialogIn.default;
      if (this.mIsMounted) {
        this.forceUpdate();
      }
    });
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public render(): JSX.Element {
    const { t, buttonType } = this.props;
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
