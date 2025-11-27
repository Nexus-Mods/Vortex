import * as React from 'react';
import { ListGroupItem } from 'react-bootstrap';

export interface IPluginEntryProps {
  className?: string;
  item: string;
}

type IProps = IPluginEntryProps;

class PluginEntry extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const { className, item } = this.props;

    let classes = ['plugin-entry'];
    if (className !== undefined) {
      classes = classes.concat(className.split(' '));
    }

    return (
      <ListGroupItem className={classes.join(' ')}>
        {item}
      </ListGroupItem>);
  }
}

export default PluginEntry;
