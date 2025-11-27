import * as React from 'react';
import { DropdownButton } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import { withTranslation } from 'react-i18next';
import { ComponentEx, Icon } from 'vortex-api';
import TutorialButton from './TutorialButton';

import IYoutubeInfo from '../types/YoutubeInfo';

interface IComponentState {
  show: boolean;
}

interface IBaseProps {
  groupName: string;
  videos: IYoutubeInfo[];
}

type IProps = IBaseProps;

class TutorialDropdown extends ComponentEx<IProps, IComponentState> {
  private mRef: Element;

  constructor(props: IProps) {
    super(props);
    this.initState({
      show: false,
    });
  }

  public render(): JSX.Element {
    const { show } = this.state;
    const { t, groupName, videos } = this.props;

    let titleContent: JSX.Element;
    titleContent = (
      <div className='tutorial-dropdown-title'>
        <Icon name='video'/>
        <div className='button-text'>{t('Tutorials')}</div>
      </div>
    );

    return (
      <DropdownButton
        onToggle={this.onToggle}
        open={show}
        ref={this.setRef}
        className='tutorial-dropdown-group'
        title={titleContent}
        id={'tutorial-dropdown' + groupName}
      >
        {
          videos.map((video) =>
          <TutorialButton
            onClick={this.onToggle}
            container={this.mRef}
            key={video.group + video.id}
            dropdown
            video={video}
          />)
        }
      </DropdownButton>
    );
  }

  private onToggle = (value: boolean) => {
    this.nextState.show = value;
  }

  private setRef = ref => {
    this.mRef = ref;
    if (ref !== null) {
      this.mRef = ReactDOM.findDOMNode(this.mRef) as Element;
    }
  }
}

export default withTranslation(['common'])(TutorialDropdown as any) as React.ComponentClass<{}>;
