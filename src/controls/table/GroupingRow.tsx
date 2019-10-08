import Icon from '../Icon';

import { TD, TR } from './MyTable';

import i18next from 'i18next';
import * as React from 'react';

export interface IGroupingRowProps {
  t: i18next.TFunction;
  groupName: string;
  count: number;
  expanded: boolean;
  width: number;
  onToggle: (group: string, expanded: boolean) => void;
}

class GroupingRow extends React.PureComponent<IGroupingRowProps, {}> {
  public render(): JSX.Element {
    const { t, count, expanded, groupName: group, width } = this.props;
    return (
      <TR key={`group-${group}`}>
        <TD
          className='table-group-header'
          data-group={group}
          onClick={this.toggleGroup}
          colSpan={width}
        >
          <Icon name={expanded ? 'showhide-down' : 'showhide-right'} />
          {group || t('<Empty>')} ({count})
        </TD>
      </TR>
    );
  }

  private toggleGroup = (evt: React.MouseEvent<any>) => {
    const { expanded, groupName: group, onToggle } = this.props;
    onToggle(group, !expanded);
  }
}

export default GroupingRow;
