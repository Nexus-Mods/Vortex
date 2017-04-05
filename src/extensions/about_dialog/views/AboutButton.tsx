import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import AboutDialogT from './AboutDialog';
let AboutDialog: typeof AboutDialogT = Placeholder;

import * as React from 'react';
import update = require('react-addons-update');

interface IComponentState {
  dialogVisible: boolean;
}

class AboutButton extends ComponentEx<{}, IComponentState> {
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
    const { t } = this.props;
    const { dialogVisible } = this.state;

    return (
      <span>
        <Button
          id='about-btn'
          tooltip={t('About')}
          placement='top'
          onClick={ this.showAboutLayer }
        >
          <Icon name='info'/>
        </Button>
        <AboutDialog
          shown={ dialogVisible }
          onHide={ this.hideAboutLayer }
        />
      </span>
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
