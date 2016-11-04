import { IComponentContext } from '../../../types/IComponentContext';
import { IIconDefinition } from '../../../types/IIconDefinition';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import IconBar from '../../../views/IconBar';
import InputButton from '../../../views/InputButton';

import { IDownload } from '../types/IDownload';

import DownloadDropzone from './DownloadDropzone';
import DownloadItem from './DownloadItem';

import * as React from 'react';
import { Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

interface IConnectedProps {
  downloads: IDownload[];
}

type IProps = IConnectedProps;

class DownloadView extends ComponentEx<IProps, {}> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;
  private staticButtons: IIconDefinition[];

  constructor(props) {
    super(props);
    this.state = {
      dropActive: false,
    };

    this.staticButtons = [{
      component: InputButton,
      props: () => ({
        id: 'input-download-url',
        groupId: 'download-buttons',
        key: 'input-download-url',
        icon: 'download',
        tooltip: 'Download URL',
        onConfirmed: this.startDownload,
      }),
    }];
  }

  public render(): JSX.Element {
    const { t, downloads } = this.props;
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
                <th style={{ textAlign: 'center' }}>{t('Progress')}</th>
                <th style={{ textAlign: 'center' }}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(downloads).map(this.renderDownload)}
            </tbody>
          </Table>
          <DownloadDropzone />
        </Flex>
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
      />
    );
  }
}

function mapStateToProps(state: any) {
  return {
    downloads: state.persistent.downloads.running,
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: true })(DownloadView)
  );
