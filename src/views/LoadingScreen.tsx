import ProgressBar from '../controls/ProgressBar';
import ExtensionManager from '../util/ExtensionManager';

import * as React from 'react';

export interface ILoadingScreenProps {
  extensions: ExtensionManager;
}

interface ILoadingScreenState {
  currentlyLoading: string;
  loaded: number;
}

class LoadingScreen extends React.Component<ILoadingScreenProps, ILoadingScreenState> {
  private mTotalExtensions: number;
  constructor(props: ILoadingScreenProps) {
    super(props);

    this.state = {
      currentlyLoading: '',
      loaded: 0,
    };

    const { extensions } = this.props;

    this.mTotalExtensions = extensions.numOnce;

    extensions.onLoadingExtension((name: string, idx: number) => {
      this.setState({
        currentlyLoading: name,
        loaded: idx,
      });
    });
  }

  public render(): JSX.Element {
    const { currentlyLoading, loaded } = this.state;
    return (
      <div id='loading-screen'>
        <ProgressBar
          labelLeft='Loading Extensions'
          labelRight={this.readable(currentlyLoading)}
          now={loaded}
          max={this.mTotalExtensions}
        />
      </div>
    );
  }

  private readable(input: string): string {
    if (input === undefined) {
      return 'Done';
    }
    return input
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export default LoadingScreen;
