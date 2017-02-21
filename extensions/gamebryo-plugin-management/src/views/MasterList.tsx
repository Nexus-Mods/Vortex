import { nativePlugins } from '../util/gameSupport';

import { selectors } from 'nmm-api';
import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import { connect } from 'react-redux';
import { createSelector } from 'reselect';

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
    const {masters} = this.props;
    return (<ListGroup>
      {masters.map(this.renderPlugin)}
    </ListGroup>);
  }

  private renderPlugin = (pluginName: string): JSX.Element => {
    const { installedPlugins } = this.props;
    let isInstalled = installedPlugins.has(pluginName.toLowerCase());
    return (<ListGroupItem
      style={{ padding: 5 }}
      key={`plugin-${pluginName}`}
      bsStyle={ isInstalled ? undefined : 'warning' }
    >
      {pluginName}
    </ListGroupItem>);
  }
}

const loadOrder = (state) => state.loadOrder;

let enabledPlugins = createSelector(loadOrder, selectors.activeGameId, (order, gameId) => {
  return new Set<string>([].concat(nativePlugins(gameId), Object.keys(order)
    .filter((pluginName: string) => order[pluginName].enabled)
    .map((pluginName: string) => pluginName.toLowerCase())
  ));
});

function mapStateToProps(state: any): IConnectedProps {
  return {
    installedPlugins: enabledPlugins(state),
  };
}

export default connect(mapStateToProps)(MasterList) as React.ComponentClass<IBaseProps>;
