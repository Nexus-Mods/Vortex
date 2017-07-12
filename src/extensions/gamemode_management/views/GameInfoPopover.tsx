import { IGameInfoEntry, IState } from '../../../types/IState';
import { ComponentEx, connect } from '../../../util/ComponentEx';
import { bytesToString } from '../../../util/util';
import Icon from '../../../views/Icon';

import { IGameStored } from '../types/IGameStored';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as opn from 'opn';
import * as React from 'react';
import { Table } from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  game: IGameStored;
  onRefreshGameInfo: (gameId: string) => Promise<void>;
}

interface IConnectedProps {
  gameInfo: {
    [key: string]: IGameInfoEntry,
  };
  language: string;
}

type IProps = IBaseProps & IConnectedProps;

class GameInfoPopover extends ComponentEx<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public componentWillMount() {
    const { game, onRefreshGameInfo } = this.props;
    onRefreshGameInfo(game.id);
  }

  public render(): JSX.Element {
    const { t, game } = this.props;
    const gameInfo = this.props.gameInfo || {};

    const keysToRender = Object.keys(gameInfo).filter(key => gameInfo[key].value !== null);

    return (
      <Table>
        <tbody>
          { keysToRender.map(this.renderGameInfo) }
        </tbody>
      </Table>
    );
  }

  private renderGameInfo = (key: string): JSX.Element => {
    const { t, gameInfo } = this.props;
    return (
      <tr key={key}>
        <td>{t(gameInfo[key].title)}</td>
        <td>{this.renderValue(gameInfo[key].value, gameInfo[key].type || 'string')}</td>
      </tr>
    );
  }

  private renderValue = (value: any, type: string) => {
    const { language } = this.props;
    if (type === 'date') {
      return new Date(value).toLocaleString(language);
    } else if (type === 'url') {
      return <a onClick={this.openUrl} href={value} >{value}</a>;
    } else if (type === 'bytes') {
      return bytesToString(value);
    } else {
      return value;
    }
  }

  private openUrl = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    opn(evt.currentTarget.href);
  }
}

function mapStateToProps(state: IState, ownProps: IBaseProps): IConnectedProps {
  return {
    gameInfo: state.persistent.gameMode.gameInfo[ownProps.game.id],
    language: state.settings.interface.language,
  };
}

export default connect(mapStateToProps)(GameInfoPopover) as React.ComponentClass<IBaseProps>;
