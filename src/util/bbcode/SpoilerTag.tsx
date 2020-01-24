import { TFunction } from '../i18n';

import { Tag } from 'bbcode-to-react';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';

interface ISpoilerProps {
  t: TFunction;
  content: any;
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
        <Button onClick={this.toggle}>
          {t('Spoiler')}
        </Button>
        {this.state.display ? this.props.content : null}
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
    return <SpoilerTrans content={this.getComponents()} />;
  }
}

export default SpoilerTag;
