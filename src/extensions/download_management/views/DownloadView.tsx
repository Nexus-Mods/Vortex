import { IComponentContext } from '../../../types/IComponentContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { Button } from '../../../views/TooltipControls';

import { IDownload } from '../types/IDownload';

import DownloadItem from './DownloadItem';

import * as React from 'react';
import { FormControl, Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');

import Icon = require('react-fontawesome');

interface IConnectedProps {
  downloads: IDownload[];
}

interface IComponentState {
  inputUrl: string;
}

type IProps = IConnectedProps;

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);
    this.state = {
      inputUrl: undefined,
    };
  }

  public render(): JSX.Element {
    const { t, downloads } = this.props;
    return (
      <Layout type='column'>
        <Fixed>
          <div style={{ height: '32px' }}>
            { this.renderInputUrl() }
          </div>
        </Fixed>
        <Flex style={{ height: '100%', overflowY: 'auto' }}>
          <Table bordered condensed hover>
            <thead>
              <tr>
                <th>{t('Filename')}</th>
                <th>{t('Progress')}</th>
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              { Object.keys(downloads).map(this.renderDownload) }
            </tbody>
          </Table>
        </Flex>
      </Layout>
    );
  }

  private renderInputUrl() {
    const { t } = this.props;
    if (this.state.inputUrl === undefined) {
      return (
        <Button
          id='input-url'
          tooltip={ t('Download URL') }
          onClick={ this.startInputUrl }
        >
          <Icon name='download' />
        </Button>
      );
    } else {
      const { inputUrl } = this.state;
      return (
        <Layout type='row'>
          <Flex>
            <form>
              <FormControl
                autoFocus
                type='text'
                value={inputUrl}
                onChange={this.updateUrl}
              />
            </form>
          </Flex>
          <Fixed>
            <Button
              id='accept-url'
              tooltip={t('Download')}
              onClick={this.startDownload}
            >
              <Icon name='check' />
            </Button>
            <Button
              id='cancel-url'
              tooltip={t('Cancel')}
              onClick={this.closeInputUrl}
            >
              <Icon name='remove' />
            </Button>
          </Fixed>
        </Layout>
      );
    }
  }

  private updateUrl = (event) => {
    this.setState(update(this.state, {
      inputUrl: { $set: event.target.value },
    }));
  }

  private startInputUrl = () => {
    this.setState(update(this.state, {
      inputUrl: { $set: '' },
    }));
  }

  private closeInputUrl = () => {
    this.setState(update(this.state, {
      inputUrl: { $set: undefined },
    }));
  }

  private startDownload = () => {
    this.context.api.events.emit('start-download', [ this.state.inputUrl ], {});
    this.closeInputUrl();
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
    translate([ 'common' ], { wait: true })(DownloadView)
  );
