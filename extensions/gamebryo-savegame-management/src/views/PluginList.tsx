import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { fs, selectors, types, util } from 'vortex-api';

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

  public componentWillReceiveProps(nextProps: IProps) {
    if ((this.props.discoveredGames !== nextProps.discoveredGames)
        || (this.props.gameMode !== nextProps.gameMode)) {
      this.refreshInstalled();
    }
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
    const game = util.getGame(gameMode);
    fs.readdirAsync(game.getModPaths(discovery.path)[''])
      .then((files: string[]) => {
        const plugins = files.filter((fileName: string) => {
          const ext = path.extname(fileName).toLowerCase();
          return ['.esp', '.esm', '.esl'].indexOf(ext) !== -1;
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
