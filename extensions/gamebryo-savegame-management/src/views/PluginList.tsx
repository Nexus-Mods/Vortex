import * as fs from 'fs-extra-promise';
import { selectors, types } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import update = require('react-addons-update');
import { connect } from 'react-redux';

interface IBaseProps {
  plugins: string[];
}

interface IConnectedProps {
  gameMode: string;
  discoveredGames: { [id: string]: types.IDiscoveryResult };
}

interface IComponentState {
  installedESPs: Set<string>;
}

type IProps = IBaseProps & IConnectedProps;

class PluginList extends React.Component<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      installedESPs: undefined,
    };
  }

  public componentWillMount() {
    this.refreshInstalled();
  }

  public render(): JSX.Element {
    const { plugins } = this.props;
    return (
      <ListGroup>
        {plugins.map(this.renderPlugin)}
      </ListGroup>
    );
  }

  private renderPlugin = (pluginName: string): JSX.Element => {
    const { installedESPs } = this.state;
    const isInstalled = installedESPs === undefined || installedESPs.has(pluginName.toLowerCase());
    return (
      <ListGroupItem
        style={{ padding: 5 }}
        key={`plugin-${pluginName}`}
        bsStyle={isInstalled ? undefined : 'warning'}
      >
        {pluginName}
      </ListGroupItem>
    );
  }

  private refreshInstalled() {
    const { discoveredGames, gameMode } = this.props;
    const discovery = discoveredGames[gameMode];
    fs.readdirAsync(discovery.modPath)
      .then((files: string[]) => {
        const plugins = files.filter((fileName: string) => {
          const ext = path.extname(fileName).toLowerCase();
          return ['.esp', '.esm'].indexOf(ext) !== -1;
        }).map((fileName) => fileName.toLowerCase());

        this.setState(update(this.state, {
          installedESPs: { $set: new Set<string>(plugins) },
        }));
      });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
    discoveredGames: state.settings.gameMode.discovered,
  };
}

export default connect(mapStateToProps)(PluginList) as React.ComponentClass<IBaseProps>;
