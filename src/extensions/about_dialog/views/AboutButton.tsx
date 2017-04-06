import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import ToolbarIcon from '../../../views/ToolbarIcon';

import AboutDialogT from './AboutDialog';
let AboutDialog: typeof AboutDialogT = Placeholder;

import * as React from 'react';
import update = require('react-addons-update');

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
}

interface IComponentState {
  dialogVisible: boolean;
}

type IProps = IBaseProps;

class AboutButton extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public componentWillMount() {
    asyncRequire('./AboutDialog', __dirname)
    .then(AboutDialogIn => {
      AboutDialog = AboutDialogIn.default;
      this.forceUpdate();
    });
  }

  public render(): JSX.Element {
    const { t, buttonType } = this.props;
    const { dialogVisible } = this.state;

    return (
      <ToolbarIcon
        id='about-btn'
        icon='info'
        text={t('About')}
        placement='top'
        onClick={this.showAboutLayer}
        buttonType={buttonType}
      >
        <AboutDialog
          shown={dialogVisible}
          onHide={this.hideAboutLayer}
        />
      </ToolbarIcon>
    );
  }

  private showAboutLayer = () => {
    this.setDialogVisible(true);
  }

  private hideAboutLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.setState(update(this.state, {
      dialogVisible: { $set: visible },
    }));
  }
}

export default
  translate(['common'], { wait: false })(AboutButton) as React.ComponentClass<{}>;
