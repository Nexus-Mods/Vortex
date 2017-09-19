import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Icon } from 'vortex-api';

interface IWebviewProps {
  onLoading: (loading: boolean) => void;
}

class Webview extends React.Component<IWebviewProps & IWebView, {}> {
  private mNode: any;

  public componentDidMount() {
    this.mNode = ReactDOM.findDOMNode(this);

    this.mNode.addEventListener('did-start-loading', this.startLoad);
    this.mNode.addEventListener('did-stop-loading', this.stopLoad);
    this.mNode.addEventListener('dom-ready', () => {
      // this.mNode.insertCSS('body { background-color: red !important }');
      // this.mNode.openDevTools();
    });
  }

  public componentWillUnmount() {
    this.mNode.removeEventListener('did-start-loading', this.startLoad);
    this.mNode.removeEventListener('did-stop-loading', this.stopLoad);
  }

  public render(): JSX.Element {
    return (
      <webview {..._.omit(this.props, ['onLoading'])} />
    );
  }

  private startLoad = () => {
    const { onLoading } = this.props;
    if (onLoading !== undefined) {
      onLoading(true);
    }
  }

  private stopLoad = () => {
    const { onLoading } = this.props;
    if (onLoading !== undefined) {
      onLoading(false);
    }
  }
}

interface IComponentState {
  loading: boolean;
}

class DocumentationPage extends React.Component<{}, IComponentState> {
  constructor() {
    super();

    this.state = { loading: false };
  }

  public render(): JSX.Element {
    const { loading } = this.state;
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {loading ? this.renderWait() : null}
        <Webview
          style={{ width: '100%', height: '100%' }}
          src='http://help.nexusmods.com'
          onLoading={this.onLoading}
        />
      </div>
    );
  }

  private onLoading = (loading: boolean) => {
    this.setState({ loading });
  }

  private renderWait() {
    return (
      <Icon
        name='spinner'
        pulse
        style={{
          width: '64px',
          height: '64px',
          position: 'absolute',
          top: 'auto',
          bottom: 'auto',
          left: 'auto',
          right: 'auto',
        }}
      />
    );
  }
}

export default DocumentationPage;
