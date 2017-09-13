import Icon from '../../controls/Icon';
import InputButton from '../../controls/InputButton';
import More from '../../controls/More';
import { Button } from '../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import {setSafe} from '../../util/storeHelper';
import DNDContainer from '../../views/DNDContainer';

import { addMetaserver, removeMetaserver, setPriorities } from './actions';
import getText from './texts';

import * as I18next from 'i18next';
import * as _ from 'lodash';
import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock,
         ListGroup, ListGroupItem } from 'react-bootstrap';
import {DragSource, DropTarget} from 'react-dnd';
import {findDOMNode} from 'react-dom';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

interface IServerEntry {
  url: string;
  priority: number;
}

interface IConnectedProps {
  metaservers: { [id: string]: IServerEntry };
}

interface IActionProps {
  onAddMetaserver: (url: string) => void;
  onRemoveMetaserver: (id: string) => void;
  onSetMetaserverPriority: (ids: string[]) => void;
}

interface IState {
}

type IProps = IActionProps & IConnectedProps;

const serverSource: __ReactDnd.DragSourceSpec<any> = {
  beginDrag(props) {
    return { id: props.serverId };
  },
  endDrag(props, monitor: __ReactDnd.DragSourceMonitor) {
    if (monitor.getDropResult() === null) {
      return;
    }
    const source: string = (monitor.getItem() as { id: string }).id;
    const dest: string = (monitor.getDropResult() as { id: string }).id;
    if (source !== dest) {
      props.onDrop();
    } else {
      props.onCancel();
    }
  },
};

const serverTarget: __ReactDnd.DropTargetSpec<any> = {
  hover(props, monitor, component) {
    const source = (monitor.getItem() as any).id;
    const target = props.serverId;

    if ((source !== target) && (target !== undefined)) {
      const cursorPos = monitor.getClientOffset();
      const box = findDOMNode(component).getBoundingClientRect();

      props.onHover(source, target, cursorPos.y > box.top + box.height / 2);
    }
  },
};

function collectDrag(connector: __ReactDnd.DragSourceConnector,
                     monitor: __ReactDnd.DragSourceMonitor) {
  return {
    connectDragSource: connector.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

function collectDrop(connector: __ReactDnd.DropTargetConnector,
                     monitor: __ReactDnd.DropTargetMonitor) {
  return {
    connectDropTarget: connector.dropTarget(),
    isOver: monitor.isOver(),
  };
}

interface IRowProps {
  t: I18next.TranslationFunction;
  server: IServerEntry;
  serverId: string;
  onRemoveMetaserver: (id: string) => void;
}

interface IDragProps {
  connectDragSource: __ReactDnd.ConnectDragSource;
  isDragging: boolean;
}

interface IDropProps {
  connectDropTarget: __ReactDnd.ConnectDropTarget;
  isOver: boolean;
}

type RowProps = IRowProps & IDragProps & IDropProps;

/**
 * One row in the meta-server list
 */
class ServerRow extends React.Component<RowProps, {}> {
  public render(): JSX.Element {
    const {t, connectDragSource, connectDropTarget, isDragging, server} = this.props;
    return connectDropTarget(
      connectDragSource(
        <div>
          <ListGroupItem
            active={isDragging}
            style={{ marginLeft: isDragging ? 40 : 0 }}
          >
            {server.url}
            <Button
              className='btn-embed pull-right'
              id='remove'
              tooltip={t('Remove')}
              onClick={this.removeServer}
            >
              <Icon name='remove' />
            </Button>
          </ListGroupItem>
        </div>));
  }
  private removeServer = () => {
    const {serverId, onRemoveMetaserver} = this.props;
    onRemoveMetaserver(serverId);
  }
}

const type = 'settings-metaserver-row';

const ServerRowDrag =
  DropTarget(type, serverTarget, collectDrop)(
    DragSource(type, serverSource, collectDrag)(
      ServerRow));

interface IListProps {
  t: I18next.TranslationFunction;
  metaservers: { [id: string]: IServerEntry };
  onAddMetaserver: (url: string) => void;
  onRemoveMetaserver: (id: string) => void;
  onSetMetaserverPriority: (ids: string[]) => void;
}

interface IListState {
  orderedServers: { [id: string]: IServerEntry };
}

/**
 * list of meta servers
 */
class ServerList extends React.Component<IListProps, IListState> {
  constructor(props) {
    super(props);

    this.state = {
      orderedServers: {},
    };
  }

  public componentWillMount() {
    this.pullServerState();
  }

  public componentDidUpdate(prevProps: IListProps, prevState: IListState) {
    if (!_.isEqual(prevProps.metaservers, this.props.metaservers)) {
      this.pullServerState();
    }
  }

  public render(): JSX.Element {
    const {t, onAddMetaserver} = this.props;
    const { orderedServers } = this.state;
    const keys = Object.keys(orderedServers);
    const sorted = keys.sort(
      (lhs: string, rhs: string) => orderedServers[lhs].priority - orderedServers[rhs].priority);

    return (
      <div>
      <ListGroup>
        {sorted.map(this.renderServer)}
        <ListGroupItem>
          <InputButton
            id='input-add-metaserver'
            key='input-add-metaserver'
            groupId='settings-buttons'
            icon='plus'
            tooltip={t('Add a metaserver')}
            onConfirmed={onAddMetaserver}
          />
        </ListGroupItem>
      </ListGroup>
      </div>
    );
  }

  private pullServerState() {
    const { metaservers } = this.props;

    const copy = _.cloneDeep(metaservers);
    Object.keys(copy).forEach((key: string) => {
      copy[key].priority *= 2;
    });
    this.setState({
      orderedServers: copy,
    });
  }

  private renderServer = (serverId: string) => {
    const {t, onRemoveMetaserver} = this.props;
    const {orderedServers} = this.state;
    return (
      <ServerRowDrag
        t={t}
        key={serverId}
        serverId={serverId}
        server={orderedServers[serverId]}
        onRemoveMetaserver={onRemoveMetaserver}
        onHover={this.handleHover}
        onDrop={this.handleDrop}
        onCancel={this.handleCancel}
      />
    );
  }

  private handleHover = (sourceId: string, targetId: string, bottomHalf: boolean) => {
    if ((sourceId !== targetId) && (targetId !== undefined)) {
      this.setState(setSafe(this.state, ['orderedServers', sourceId, 'priority'],
        this.state.orderedServers[targetId].priority + (bottomHalf ? 1 : -1)));
    }
  }

  private handleDrop = () => {
    const {onSetMetaserverPriority} = this.props;
    const {orderedServers} = this.state;
    const sorted = Object.keys(orderedServers).sort((lhs: string, rhs: string) => {
      return orderedServers[lhs].priority - orderedServers[rhs].priority;
    });
    onSetMetaserverPriority(sorted);
    this.pullServerState();
  }

  private handleCancel = () => {
    this.pullServerState();
  }
}

class SettingsMetaserver extends ComponentEx<IProps, IState> {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  public render(): JSX.Element {
    const { t, metaservers, onAddMetaserver,
            onRemoveMetaserver, onSetMetaserverPriority } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>
            {t('Meta server')}
            <More id='more-metaserver' name={t('Meta Server')}>
              {getText('meta-server', t)}
            </More>
          </ControlLabel>
          <DNDContainer>
            <ServerList
              t={t}
              metaservers={metaservers}
              onAddMetaserver={onAddMetaserver}
              onRemoveMetaserver={onRemoveMetaserver}
              onSetMetaserverPriority={onSetMetaserverPriority}
            />
          </DNDContainer>
          <HelpBlock>{t('Servers to query for meta data.')}</HelpBlock>
        </FormGroup>
      </form>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    metaservers: state.settings.metaserver.servers,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddMetaserver: (url: string): void => {
      dispatch(addMetaserver(shortid(), url));
    },
    onRemoveMetaserver: (id: string): void => {
      dispatch(removeMetaserver(id));
    },
    onSetMetaserverPriority: (ids: string[]): void => {
      dispatch(setPriorities(ids));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsMetaserver)) as React.ComponentClass<{}>;
