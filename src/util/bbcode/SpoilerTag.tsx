import { TFunction } from '../i18n';

import { Tag } from 'bbcode-to-react';
import * as React from 'react';
import { withTranslation } from 'react-i18next';

interface ISpoilerProps {
  t: TFunction;
  content: any;
  label?: string;
}

class Spoiler extends React.Component<ISpoilerProps, { display: boolean }> {
  constructor(props) {
    super(props);

    this.state = { display: false };
  }

  public render(): JSX.Element {
    const { t } = this.props;
    return (
      <div className='bbcode-spoiler-tag'>
        <a onClick={this.toggle}>
          {t(this.props.label ?? 'More')}
        </a>
        {this.state.display ? (
          <div className='bbcode-spoiler-content'>
            {this.props.content}
          </div>
        ) : null}
      </div>
    );
  }

  private toggle = () => {
    this.setState({ display: !this.state.display });
  }
}

const SpoilerTrans = withTranslation(['common'])(Spoiler) as React.ComponentClass<any>;

class SpoilerTag extends Tag {
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact() {
    return <SpoilerTrans content={this.getComponents()} label={this.params.label} />;
  }
}

export default SpoilerTag;
