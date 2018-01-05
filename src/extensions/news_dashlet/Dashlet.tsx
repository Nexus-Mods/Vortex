import Dashlet from '../../controls/Dashlet';
import Icon from '../../controls/Icon';
import bbcode from '../../util/bbcode';
import { ComponentEx, translate } from '../../util/ComponentEx';

import rss, {IFeedMessage} from './rss';

import * as opn from 'opn';
import * as React from 'react';
import { Alert, ListGroup, ListGroupItem } from 'react-bootstrap';
import { getSafe } from '../../util/storeHelper';

export interface IExtra {
  attribute: string;
  icon: string;
  text: string;
}

export interface IBaseProps {
  title: string;
  url: string;
  maxLength: number;
  extras: IExtra[];
}

interface IComponentState {
  messages?: IFeedMessage[];
  error?: string;
}

type IProps = IBaseProps;

class RSSDashlet extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean = false;

  constructor(props) {
    super(props);

    this.state = {};
  }

  public componentDidMount() {
    this.mMounted = true;
    rss(this.props.url)
    .then(result => {
      if (this.mMounted) {
        this.setState({
          messages: result.map(this.transformMessage),
        });
    }
    })
    .catch((err: Error) => {
      this.setState({
        error: err.message,
      });
    });
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t, title } = this.props;
    const { error, messages } = this.state;
    return (
      <Dashlet className='dashlet-news' title={title}>
        {error !== undefined ? <Alert>{t('No messages received')}</Alert> : null}
        {messages !== undefined ? this.renderMessages(messages) : null}
      </Dashlet>
    );
  }

  private transformMessage(input: IFeedMessage): IFeedMessage {
    const res = { ...input };
    res.titleRendered = bbcode(input.title);
    res.descriptionRendered = bbcode(getSafe(input, ['nexusmods:summary', '#'], input.description));
    return res;
  }

  private renderMessages(messages: IFeedMessage[]): JSX.Element {
    return (
      <ListGroup className='list-news'>
        {messages.map(this.renderMessage)}
      </ListGroup>
    );
  }

  private renderMessage = (message: IFeedMessage): JSX.Element => {
    const { t, extras, maxLength } = this.props;
    const shortened = message.descriptionRendered[0];
    if (shortened === undefined) {
      return;
    }

    const category = getSafe(message, ['categories', 0], undefined);
    const image = message.enclosures.find(enc => enc.type.startsWith('image/'));

    return (
      <ListGroupItem className='rss-item' key={message.guid}>
        {category ? <div className='rss-category'>{category}</div> : null}
        <div
          className='rss-image'
          style={{ background: image !== undefined ? `url(${image.url})` : undefined }}
        />
        <h4><a href={message.link} onClick={this.openMore}>{message.titleRendered}</a></h4>
        {shortened}
        {
          extras !== undefined
            ? (
              <div className='rss-extras'>
                {extras.map(extra => this.renderExtra(message, extra))}
              </div>
            ) : null
        }
      </ListGroupItem>
    );
  }

  private renderExtra = (message: IFeedMessage, extra: IExtra) => {
    const { t } = this.props;
    let value = message[extra.attribute];
    if (value === undefined) {
      return null;
    }

    if ((typeof(value) === 'object') && (value['#'] !== undefined)) {
      value = value['#'];
    }

    return (
      <div key={extra.attribute}>
        <Icon name={extra.icon} />{t(extra.text, { replace: { value } })}
      </div>
    );
  }

  private openMore = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    opn(evt.currentTarget.href);
  }
}

export default translate([ 'common' ], { wait: true })(RSSDashlet);
