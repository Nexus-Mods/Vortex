import { gameSupported, nativePlugins } from '../util/gameSupport';

import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';
import { selectors } from 'vortex-api';

interface IBaseProps {
  masters: string[];
}

interface IConnectedProps {
  installedPlugins: Set<string>;
}

type IProps = IBaseProps & IConnectedProps;

class MasterList extends React.Component<IProps, {}> {
  constructor(props: IProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { masters } = this.props;
    if (masters === undefined) {
      return null;
    }
    return (
      <ListGroup>
        {masters.map(this.renderPlugin)}
      </ListGroup>);
  }

  private renderPlugin = (pluginName: string): JSX.Element => {
    const { installedPlugins } = this.props;
    const isInstalled = installedPlugins.has(pluginName.toLowerCase());
    return (
      <ListGroupItem
        style={{ padding: 5 }}
        key={`plugin-${pluginName}`}
        bsStyle={isInstalled ? undefined : 'warning'}
      >
        {pluginName}
      </ListGroupItem>);
  }
}

const loadOrder = (state) => state.loadOrder;

const enabledPlugins = createSelector(loadOrder, selectors.activeGameId, (order, gameId) => {
  if (!gameSupported(gameId)) {
    return new Set<string>([]);
  }
  return new Set<string>([].concat(nativePlugins(gameId), Object.keys(order)
    .filter((pluginName: string) => order[pluginName].enabled)
    .map((pluginName: string) => pluginName.toLowerCase()),
  ));
});

function mapStateToProps(state: any): IConnectedProps {
  return {
    installedPlugins: enabledPlugins(state),
  };
}

export default connect(mapStateToProps)(MasterList) as React.ComponentClass<IBaseProps>;
