import { IComponentContext } from '../../../types/IComponentContext';
import { IIconDefinition } from '../../../types/IIconDefinition';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import {setSafe} from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import InputButton from '../../../views/InputButton';
import {Button} from '../../../views/TooltipControls';

import { IDownload } from '../types/IDownload';

import DownloadDropzone from './DownloadDropzone';
import DownloadItem from './DownloadItem';

import * as React from 'react';
import { Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

interface IConnectedProps {
  downloads: IDownload[];
  gameMode: string;
}

type IProps = IConnectedProps;

interface IComponentState {
  dropActive: boolean;
  showAll: boolean;
}

interface IAllGamesButtonProps {
  id: string;
  showAll: boolean;
  onClick: Function;
  t: (input: string) => string;
}

const AllGamesButton = (props) => {
  const { t, id, onClick, showAll } = props;
  let tooltip =
    showAll
    ? t('Hide downloads from other games')
    : t('Show downloads from other games');
  return (
    <Button
      id={id}
      tooltip={tooltip}
      onClick={onClick}
    >
      <Icon name={showAll ? 'eye' : 'eye-slash'}/>
    </Button>
  );
};

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;
  private staticButtons: IIconDefinition[];

  constructor(props) {
    super(props);
    this.state = {
      dropActive: false,
      showAll: false,
    };

    this.staticButtons = [
      {
        component: AllGamesButton as any,
        props: () => ({
          id: 'btn-show-all-games',
          key: 'btn-show-all-games',
          showAll: this.state.showAll,
          t: props.t,
          onClick: () => this.setState(setSafe(this.state, ['showAll'], !this.state.showAll)),
        }),
      },
      {
        component: InputButton,
        props: () => ({
          id: 'input-download-url',
          groupId: 'download-buttons',
          key: 'input-download-url',
          icon: 'download',
          tooltip: 'Download URL',
          onConfirmed: this.startDownload,
        }),
      },
    ];
  }

  public render(): JSX.Element {
    const { t, downloads, gameMode } = this.props;
    const { showAll } = this.state;

    let filtered =
      showAll
      ? Object.keys(downloads)
      : Object.keys(downloads).filter((downloadId: string) => {
        return downloads[downloadId].game === gameMode;
      });

    return (
      <Layout type='column'>
        <Fixed>
          <IconBar
            group='download-icons'
            staticElements={this.staticButtons}
            style={{ width: '100%', display: 'flex' }}
          />
        </Fixed>
        <Flex style={{ height: '100%', overflowY: 'auto' }} >
          <Table bordered condensed hover>
            <thead>
              <tr>
                <th>{t('Filename')}</th>
                { showAll ? <th>{t('Game')}</th> : null }
                <th style={{ textAlign: 'center' }}>{t('Progress')}</th>
                <th style={{ textAlign: 'center' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(this.renderDownload)}
            </tbody>
          </Table>
        </Flex>
        <Fixed>
          <DownloadDropzone />
        </Fixed>
      </Layout>
    );
  }

  private startDownload = (url: string) => {
    this.context.api.events.emit('start-download', [url], {});
  }

  private renderDownload = (key: string) => {
    const { downloads } = this.props;
    return (
      <DownloadItem
        key={key}
        downloadId={key}
        download={downloads[key]}
        showGame={this.state.showAll}
      />
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    downloads: state.persistent.downloads.files,
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: false })(DownloadView)
  );
