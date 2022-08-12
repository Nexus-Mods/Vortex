import bbcode, { stripBBCode } from '../../util/bbcode';
import { ComponentEx, translate } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';
import { currentGame } from '../gamemode_management/selectors';
import { nexusGameId } from '../nexus_integration/util/convertGameId';

import BaseDashlet from './BaseDashlet';
import { GAMEID_PLACEHOLDER, MAX_SUMMARY_LENGTH } from './constants';
import rss, {IFeedMessage} from './rss';

import * as React from 'react';
import { connect as redConnect } from 'react-redux';
import { IListItem } from './types';

export interface IConnectedProps {
  nexusGameId: string;
}

export interface IExtra {
  attribute: string;
  icon: string;
  text: string;
}

export interface IBaseProps {
  title: string;
  emptyText: string;
  url: string;
  maxLength: number;
  extras: IExtra[];
}

interface IComponentState {
  messages?: IListItem[];
  error?: string;
}

type IProps = IConnectedProps & IBaseProps;

class RSSDashlet extends ComponentEx<IProps, IComponentState> {
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

  public componentDidUpdate(oldProps: IConnectedProps) {
    if (oldProps.nexusGameId !== this.props.nexusGameId) {
      this.refresh();
    }
  }

  public render(): JSX.Element {
    const { t, emptyText, title } = this.props;
    const { error, messages } = this.state;

    return (
      <BaseDashlet
        t={t}
        title={title}
        items={messages}
        error={error}
        emptyText={emptyText}
        onRefresh={this.refresh}
      />
    );
  }

  private refresh = () => {
    const { url } = this.props;
    const rssUrl = ((this.props.nexusGameId !== undefined)
                 && (url.indexOf(GAMEID_PLACEHOLDER) !== -1))
      ? url.replace(GAMEID_PLACEHOLDER, this.props.nexusGameId)
      : url;

    rss(rssUrl)
    .then(result => {
      if (this.mMounted) {
        this.setState({
          messages: result.map(item => this.transformMessage(item)),
          error: undefined,
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

  private transformMessage(input: IFeedMessage): IListItem {
    const { extras } = this.props;

    const image = input.enclosures.find(enc =>
      (!truthy(enc.type) || enc.type.startsWith('image/')) && truthy(enc.url));

    const messageInput = getSafe(input, ['nexusmods:summary', '#'], input.description);

    let summary = stripBBCode(messageInput);
    if (summary.length > MAX_SUMMARY_LENGTH) {
      summary = summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
    }

    const convertValue = (value) => {
      if ((typeof(value) === 'object') && (value['#'] !== undefined)) {
        return value['#'];
      }
      return value;
    };

    return {
      name: bbcode(input.title),
      link: input.link,
      imageUrl: image?.url,
      category: input.categories?.[0],
      summary,
      extra: extras.map(iter => ({
        id: iter.text,
        text: iter.text,
        icon: iter.icon,
        value: convertValue(input[iter.attribute]),
      })),
    };
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const game = currentGame(state);
  const gameId = (game !== undefined)
    ? nexusGameId(game)
    : undefined;
  return {
    nexusGameId: gameId,
  };
}

export default translate([ 'common' ])
  (redConnect(mapStateToProps)(RSSDashlet)) as React.ComponentClass<{}>;
