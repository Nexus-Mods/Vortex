import ToolbarIcon from '../../../controls/ToolbarIcon';
import asyncRequire, { Placeholder } from '../../../util/asyncRequire';
import { ComponentEx, translate } from '../../../util/ComponentEx';

import * as update from 'immutability-helper';
import * as React from 'react';

export interface IBaseProps {
  buttonType: 'icon' | 'text' | 'both';
}

interface IComponentState {
}

type IProps = IBaseProps;

class AboutButton extends ComponentEx<IProps, IComponentState> {
  public render(): JSX.Element {
    const { t, buttonType } = this.props;

    return (
      <ToolbarIcon
        id='about-btn'
        icon='about'
        text={t('About')}
        placement='top'
        onClick={this.showAboutLayer}
      />
    );
  }

  private showAboutLayer = () => {
    this.context.api.events.emit('show-main-page', 'About');
  }
}

export default
  translate(['common'], { wait: false })(AboutButton) as React.ComponentClass<{}>;
