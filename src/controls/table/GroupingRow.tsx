import { ComponentEx } from '../../util/ComponentEx';
import { TFunction } from '../../util/i18n';
import { IActionDefinitionEx } from '../ActionControl';
import ContextMenu from '../ContextMenu';
import Icon from '../Icon';

import { TD, TR } from './MyTable';

import i18next from 'i18next';
import * as React from 'react';
import * as Redux from 'redux';

export const EMPTY_ID = '<Unspecified>';

export interface IGroupingRowProps {
  t: TFunction;
  groupName: string;
  count: number;
  expanded: boolean;
  width: number;
  onToggle: (group: string, expand: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

interface IGroupingRowState {
  context?: { x: number, y: number };
}

class GroupingRow extends ComponentEx<IGroupingRowProps, IGroupingRowState> {
  private mContextActions: IActionDefinitionEx[];

  constructor(props: IGroupingRowProps) {
    super(props);

    this.initState({
      context: undefined,
    });

    this.mContextActions = [
      {
        title: this.props.t('Expand all'),
        action: this.props.onExpandAll,
        show: true,
      },
      {
        title: this.props.t('Collapse all'),
        action: this.props.onCollapseAll,
        show: true,
      },
    ];
  }

  public render(): JSX.Element {
    const { t, count, expanded, groupName, width } = this.props;
    const { context } = this.state;
    return (
      <TR key={`group-${groupName}`} onContextMenu={this.onContext}>
        <TD
          className='table-group-header'
          data-group={groupName}
          onClick={this.toggleGroup}
          colSpan={width}
        >
          <ContextMenu
            instanceId={groupName}
            actions={this.mContextActions}
            visible={context !== undefined}
            position={context}
            onHide={this.onHideContext}
          />

          <Icon name={expanded ? 'showhide-down' : 'showhide-right'} />
          {t(groupName) || t(EMPTY_ID)} ({count})
        </TD>
      </TR>
    );
  }

  private toggleGroup = () => {
    const { expanded, groupName, onToggle } = this.props;
    onToggle(groupName, !expanded);
  }

  private onContext = (event: React.MouseEvent<any>) => {
    this.setState({ context: { x: event.clientX, y: event.clientY } });
  }

  private onHideContext = () => {
    this.setState({ context: undefined });
  }
}

export default GroupingRow;
