import Dashlet from '../../controls/Dashlet';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import Icon from '../../controls/Icon';
import { IconButton } from '../../controls/TooltipControls';
import bbcode, { stripBBCode } from '../../util/bbcode';
import { ComponentEx, translate } from '../../util/ComponentEx';
import opn from '../../util/opn';
import { getSafe } from '../../util/storeHelper';

import rss, {IFeedMessage} from './rss';

import * as React from 'react';
import { Alert, ListGroup, ListGroupItem } from 'react-bootstrap';

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
  private static MAX_MESSAGE_LENGTH = 200;
  private mMounted: boolean = false;

  constructor(props) {
    super(props);

    this.state = {};
  }

  public componentDidMount() {
    this.mMounted = true;
    this.refresh();
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t, title } = this.props;
    const { error, messages } = this.state;
    return (
      <Dashlet className='dashlet-news' title={title}>
        <IconButton
          className='issues-refresh'
          icon='refresh'
          tooltip={t('Refresh Issues')}
          onClick={this.refresh}
        />

        {error !== undefined ? <Alert>{t('No messages received')}</Alert> : null}
        {((messages || []).length !== 0) ? this.renderMessages(messages) : this.renderPlaceholder()}
      </Dashlet>
    );
  }

  private renderPlaceholder(): JSX.Element {
    const { t } = this.props;
    return (
      <EmptyPlaceholder
        icon='layout-list'
        text={t('No news')}
        subtext={t('*crickets chirp*')}
      />
    );
  }

  private refresh = () => {
    rss(this.props.url)
    .then(result => {
      if (this.mMounted) {
        this.setState({
          messages: result.map(this.transformMessage),
        });
      }
    })
    .catch((err: Error) => {
      if (this.mMounted) {
        this.setState({
          error: err.message,
        });
      }
    });
  }

  private transformMessage(input: IFeedMessage): IFeedMessage {
    const res = { ...input };

    const messageInput = getSafe(input, ['nexusmods:summary', '#'], input.description);
    res.titleRendered = bbcode(input.title);
    res.descriptionRendered = bbcode(messageInput);
    res.descriptionShortened = stripBBCode(messageInput);
    if (res.descriptionShortened.length > RSSDashlet.MAX_MESSAGE_LENGTH) {
      res.descriptionShortened = res.descriptionShortened.substr(0, RSSDashlet.MAX_MESSAGE_LENGTH) + '...';
    }
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
    const { extras } = this.props;
    const shortened = message.descriptionShortened;
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
        <p className='rss-summary'>{shortened}</p>
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
    opn(evt.currentTarget.href).catch(err => undefined);
  }
}

export default translate([ 'common' ], { wait: true })(RSSDashlet);
