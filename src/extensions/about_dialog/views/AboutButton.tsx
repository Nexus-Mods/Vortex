import ToolbarIcon from '../../../controls/ToolbarIcon';
import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import AboutPageT from './AboutPage';
let AboutPage: typeof AboutPageT = Placeholder;

import * as update from 'immutability-helper';
import * as React from 'react';

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
}

interface IComponentState {
  dialogVisible: boolean;
}

type IProps = IBaseProps;

class AboutButton extends ComponentEx<IProps, IComponentState> {
  private mIsMounted: boolean = false;
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public componentWillMount() {
    this.mIsMounted = true;
    asyncRequire('./AboutPage', __dirname)
    .then(AboutPageIn => {
      AboutPage = AboutPageIn.default;
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
        id='about-btn'
        icon='info'
        text={t('About')}
        placement='top'
        onClick={this.showAboutLayer}
        buttonType={buttonType}
      />
    );
  }

  private showAboutLayer = () => {
    this.setDialogVisible(true);
  }

  private hideAboutLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.context.api.events.emit('show-main-page', 'About');
  }
}

export default
  translate(['common'], { wait: false })(AboutButton) as React.ComponentClass<{}>;
