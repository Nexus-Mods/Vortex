import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';

interface IBaseProps {
  masters: string[];
  installedPlugins: Set<string>;
}

type IProps = IBaseProps;

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
export default MasterList;
