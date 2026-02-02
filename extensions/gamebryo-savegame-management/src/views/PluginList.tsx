import update from "immutability-helper";
import * as React from "react";
import { ListGroup, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";
import { log, selectors, types } from "vortex-api";

interface IBaseProps {
  plugins: string[];
  getInstalledPlugins: () => Promise<string[]>;
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

  public componentDidMount() {
    this.refreshInstalled();
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (
      this.props.discoveredGames !== nextProps.discoveredGames ||
      this.props.gameMode !== nextProps.gameMode
    ) {
      this.refreshInstalled();
    }
  }

  public render(): JSX.Element {
    const { plugins } = this.props;

    const pluginsSet = new Set(plugins);
    return (
      <ListGroup>{Array.from(pluginsSet).map(this.renderPlugin)}</ListGroup>
    );
  }

  private renderPlugin = (pluginName: string): JSX.Element => {
    const { installedESPs } = this.state;
    const isInstalled =
      installedESPs === undefined ||
      installedESPs.has(pluginName.toLowerCase());
    return (
      <ListGroupItem
        style={{ padding: 5 }}
        key={`plugin-${pluginName}`}
        bsStyle={isInstalled ? undefined : "warning"}
      >
        {pluginName}
      </ListGroupItem>
    );
  };

  private refreshInstalled() {
    const { getInstalledPlugins } = this.props;

    getInstalledPlugins()
      .catch((err) => {
        log("error", "failed to get list of installed plugins", {
          error: err.message,
        });
      })
      .then((plugins: string[]) => {
        this.setState(
          update(this.state, {
            installedESPs: { $set: new Set<string>(plugins) },
          }),
        );
      });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
    discoveredGames: state.settings.gameMode.discovered,
  };
}

export default connect(mapStateToProps)(
  PluginList,
) as unknown as React.ComponentClass<IBaseProps>;
