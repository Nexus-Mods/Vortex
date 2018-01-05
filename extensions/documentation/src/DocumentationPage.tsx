import * as _ from 'lodash';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Icon, Spinner, Webview } from 'vortex-api';

interface IComponentState {
  loading: boolean;
}

class DocumentationPage extends React.Component<{}, IComponentState> {
  constructor(props: {}) {
    super(props);

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
      <Spinner
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
