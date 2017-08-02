import bbcode from '../../util/bbcode';
import { ComponentEx, translate } from '../../util/ComponentEx';

import rss, {IFeedMessage} from './rss';

import * as opn from 'opn';
import * as React from 'react';
import { Alert, ListGroup, ListGroupItem } from 'react-bootstrap';

export interface IBaseProps {
  title: string;
  url: string;
  maxLength: number;
}

interface IComponentState {
  messages?: IFeedMessage[];
  error?: string;
}

type IProps = IBaseProps;

class Dashlet extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);

    this.state = {};
  }

  public componentWillMount() {
    rss(this.props.url)
    .then(result => {
      this.setState({
        messages: result,
      });
    })
    .catch((err: Error) => {
      this.setState({
        error: err.message,
      });
    });
  }

  public render(): JSX.Element {
    const { t, title } = this.props;
    const { error, messages } = this.state;
    return (
      <div className='dashlet dashlet-news'>
        <h4>{title}</h4>
        {error !== undefined ? <Alert>{t('No messages received')}</Alert> : null}
        {messages !== undefined ? this.renderMessages(messages) : null}
      </div>
    );
  }

  private renderMessages(messages: IFeedMessage[]): JSX.Element {
    return (
      <ListGroup className='list-news'>
        {messages.map(this.renderMessage)}
      </ListGroup>
    );
  }

  private renderMessage = (message: IFeedMessage): JSX.Element => {
    const { t, maxLength } = this.props;
    let shortened = message.description;
    if (shortened === null) {
      return;
    }
    if (shortened.length > maxLength) {
      shortened = shortened.substr(0, maxLength) + '...';
    }
    return (
      <ListGroupItem key={message.guid}>
        <h4><a href={message.link} onClick={this.openMore}>{bbcode(message.title)}</a></h4>
        {bbcode(shortened)}
      </ListGroupItem>
    );
  }

  private openMore = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    opn(evt.currentTarget.href);
  }
}

export default translate([ 'common' ], { wait: true })(Dashlet);
