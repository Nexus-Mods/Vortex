import { Tag } from 'bbcode-to-react';
import * as I18next from 'i18next';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import { translate } from 'react-i18next';

interface ISpoilerProps {
  t: I18next.TranslationFunction;
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
          { t('Spoiler') }
        </Button>
        {this.state.display ? this.props.content : null}
      </div>
      );
  }

  private toggle = () => {
    this.setState({ display: !this.state.display });
  }
}

const SpoilerTrans = translate(['common'], { wait: true })(Spoiler) as React.ComponentClass<any>;

class SpoilerTag extends Tag {
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact() {
    return <SpoilerTrans content={this.getComponents()} />;
  }
}

export default SpoilerTag;
