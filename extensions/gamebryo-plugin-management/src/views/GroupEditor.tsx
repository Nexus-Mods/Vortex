import { addGroup, addGroupRule, removeGroup,
         removeGroupRule, setGroup } from '../actions/userlist';
import { openGroupEditor } from '../actions/userlistEdit';
import { ILOOTList } from '../types/ILOOTList';

import genGraphStyle from '../util/genGraphStyle';

import { NAMESPACE } from '../statics';

import GraphView, { IGraphElement, IGraphSelection } from './GraphView';

import * as React from 'react';
import { Button } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { actions, ComponentEx, ContextMenu, log, Modal, types, Usage } from 'vortex-api';

interface IConnectedProps {
  open: boolean;
  userlist: ILOOTList;
  masterlist: ILOOTList;
}

interface IActionProps {
  onOpen: (open: boolean) => void;
  onAddGroup: (group: string) => void;
  onSetGroup: (pluginId: string, groupId: string) => void;
  onRemoveGroup: (group: string) => void;
  onAddGroupRule: (group: string, reference: string) => void;
  onRemoveGroupRule: (group: string, reference: string) => void;
  onShowDialog: (type: types.DialogType, title: string, content: types.IDialogContent,
                 actions: types.DialogActions) => Promise<types.IDialogResult>;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  elements: { [id: string]: IGraphElement };
  context: {
    x: number,
    y: number,
    selection?: IGraphSelection,
  };
}

class GroupEditor extends ComponentEx<IProps, IComponentState> {
  private mContextTime: number;
  private mGraphRef: GraphView;

  private contextNodeActions = [
    {
      title: 'Remove',
      show: true,
      action: () => this.removeSelection(),
    },
   ];

  private contextBGActions = [
    {
      title: 'Add Group',
      show: true,
      action: () => this.addGroup(),
    },
    {
      title: 'Layout',
      show: true,
      action: () => this.mGraphRef.layout(),
    },
    {
      title: 'Reset...',
      show: true,
      action: () => this.reset(),
    },
  ];

  constructor(props: IProps) {
    super(props);
    this.initState({
      elements: this.genElements(props),
      context: undefined,
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if ((this.props.userlist !== newProps.userlist)
        || (this.props.masterlist !== newProps.masterlist)) {
     this.nextState.elements = this.genElements(newProps);
    }
  }

  public render(): JSX.Element {
    const { t, open } = this.props;
    const { elements } = this.state;
    const sheet = this.getThemeSheet();
    let contextActions;
    if (this.state.context !== undefined) {
      contextActions = (this.state.context.selection !== undefined)
        ? this.contextNodeActions
        : this.contextBGActions;
    }

    return (
      <Modal
        id='plugin-group-editor'
        show={open}
        onHide={this.close}
      >
        <Modal.Header><Modal.Title>{t('Groups')}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Usage persistent infoId='plugins-group-editor' className='group-editor-usage'>
            <div>{t('Hold ctrl and drag a line from one group to another to define a rule.')}</div>
            <div>{t('Right click a line/node to remove the corresponding rule/group.')}</div>
            <div>{t('Right click empty area to create new Group.')}</div>
            <div>{t('Masterlist groups and rules can\'t be removed.')}</div>
            <div>{t('Use the mouse wheel to zoom, drag on an empty area to pan the view')}</div>
          </Usage>
          <GraphView
            className='group-graph'
            elements={elements}
            visualStyle={genGraphStyle(sheet)}
            onConnect={this.connect}
            onDisconnect={this.disconnect}
            onRemove={this.props.onRemoveGroup}
            onContext={this.openContext}
            ref={this.setGraphRef}
          />
          <ContextMenu
            position={this.state.context}
            visible={this.state.context !== undefined}
            onHide={this.hideContext}
            instanceId='42'
            actions={contextActions}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>{t('Close')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private setGraphRef = (ref: GraphView) => {
    this.mGraphRef = ref;
  }

  private connect = (source: string, target: string) => {
    const { onAddGroup, onAddGroupRule, masterlist, userlist } = this.props;
    const masterExisting = masterlist.groups.find(grp => grp.name === target);
    if ((masterExisting !== undefined)
        && (userlist.groups.find(grp => grp.name === target) === undefined)) {
      onAddGroup(target);
    }
    if (masterExisting && (masterExisting.after ?? []).includes(source)) {
      log('info', 'not adding userlist rule since it\'s already a masterlist rule');
      return;
    }
    onAddGroupRule(target, source);
  }

  private disconnect = (source: string, target: string) => {
    const { onRemoveGroupRule } = this.props;
    onRemoveGroupRule(target, source);
  }

  private removeSelection = () => {
    const { id, source, target } = this.state.context.selection;
    if (id !== undefined) {
      // TODO: Need to remove this groups from all after rules in plugins and other groups!
      this.props.onRemoveGroup(id);
    } else {
      // Try to remove the connection in both directions to handle direction inconsistencies
      // This ensures removal works regardless of how sourceOrig/targetOrig are stored
      this.props.onRemoveGroupRule(target, source);
      this.props.onRemoveGroupRule(source, target);
    }
  }

  private addGroup = () => {
    const { onAddGroup, onShowDialog } = this.props;
    onShowDialog('question', 'Add Group', {
      input: [
        { id: 'newGroup', value: 'New group name', label: 'Group Name' },
      ],
    }, [{ label: 'Cancel' }, { label: 'Add', default: true }])
    .then((result: types.IDialogResult) => {
        if (result.action === 'Add') {
          if (result.input.newGroup.trim().length === 0) {
            log('error', 'Group name can\'t be empty');
            return;
          } else {
            onAddGroup(result.input.newGroup);
          }
        }
      });
  }

  private reset = () => {
    const { onRemoveGroup, onRemoveGroupRule, onSetGroup,
            onShowDialog, masterlist, userlist } = this.props;
    onShowDialog('question', 'Reset Customisations', {
      text: 'This will remove customizations you have made to groups. This can\'t be undone!',
      checkboxes: [
        { id: 'default_groups', text: 'Revert pre-configured groups to default', value: true },
        { id: 'custom_groups', text: 'Remove custom groups', value: true },
      ],
    }, [ { label: 'Cancel' }, { label: 'Continue' } ])
    .then((result: types.IDialogResult) => {
      if (result.action === 'Cancel') {
        return;
      }
      const masterlistGroups = new Set<string>(masterlist.groups.map(group => group.name));
      if (result.input.custom_groups) {
        // unassign all plugins from custom groups
        userlist.plugins
          .forEach(plugin => {
            if ((plugin.group !== undefined) && !masterlistGroups.has(plugin.group)) {
              onSetGroup(plugin.name, undefined);
            }
          });
        // remove all references from masterlist groups to custom groups
        userlist.groups
          .filter(group => masterlistGroups.has(group.name))
          .forEach(group => {
            (group.after || [])
              .filter(after => !masterlistGroups.has(after))
              .forEach(after => {
                onRemoveGroupRule(group.name, after);
              });
          });
        // remove all custom groups
        userlist.groups
          .filter(group => !masterlistGroups.has(group.name))
          .forEach(group => {
            onRemoveGroup(group.name);
          });
      }

      // do the default groups second, otherwise we'd have to update the userlist object
      // for th custom_groups step to work
      if (result.input.default_groups) {
        // remove all groups known in the masterlist from the userlist
        userlist.groups
          .filter(group => masterlistGroups.has(group.name))
          .forEach(group => {
            onRemoveGroup(group.name);
          });
      }
    });
  }

  private openContext = (x: number, y: number, selection: IGraphSelection) => {
    if ((selection !== undefined) && selection.readonly) {
      return;
    }
    this.nextState.context = { x, y, selection };
    this.mContextTime = Date.now();
  }

  private hideContext = () => {
    if (Date.now() - this.mContextTime < 100) {
      // workaround: somehow I can't prevent the event that opens the context menu from being
      // propagated up, which will be picked up as close event
      return;
    }
    this.nextState.context = undefined;
  }

  private getThemeSheet(): CSSStyleRule[] {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < document.styleSheets.length; ++i) {
      if ((document.styleSheets[i].ownerNode as any).id === 'theme') {
        return Array.from((document.styleSheets[i] as any).rules);
      }
    }
    return [];
  }

  private close = () => {
    const { onOpen } = this.props;
    onOpen(false);
  }

  private genElements(props: IProps): { [id: string]: IGraphElement } {
    const { masterlist, userlist } = props;

    return [].concat(
      (masterlist.groups || []).map(group => ({
        title: group.name,
        connections: [ { class: 'masterlist', connections: group.after || [] } ],
        class: `masterlist group-${group.name.replace(/[^A-Za-z0-9]/g, '_')}`,
        readonly: true,
      })),
      (userlist.groups || []).map(group => ({
        title: group.name,
        connections: [ { class: 'userlist', connections: group.after || [] } ],
        class: `userlist group-${group.name.replace(/[^A-Za-z0-9]/g, '_')}`,
      })),
    ).reduce((prev, ele) => {
      if (prev[ele.title] !== undefined) {
        // masterlist entries are listed first, don't overwrite the class
        // or readonly flag
        prev[ele.title].connections =
          [].concat(prev[ele.title].connections, ele.connections);
        prev[ele.title].readonly = false;
      } else {
        prev[ele.title] = ele;
      }
      return prev;
    }, {});
  }
}

const emptyList: ILOOTList = {
  globals: [],
  groups: [],
  plugins: [],
};

function mapStateToProps(state): IConnectedProps {
  return {
    open: state.session.pluginDependencies.groupEditorOpen,
    masterlist: state.masterlist || emptyList,
    userlist: state.userlist || emptyList,
  };
}

type DispatchFunc = ThunkDispatch<types.IState, null, Redux.Action>;

function mapDispatchToProps(dispatch: DispatchFunc): IActionProps {
  return {
    onOpen: (open: boolean) => dispatch(openGroupEditor(open)),
    onAddGroup: (groupId: string) =>
      dispatch(addGroup(groupId)),
    onRemoveGroup: (groupId: string) =>
      dispatch(removeGroup(groupId)),
    onSetGroup: (pluginId: string, groupId: string) =>
      dispatch(setGroup(pluginId, groupId)),
    onAddGroupRule: (groupId: string, reference: string) =>
      dispatch(addGroupRule(groupId, reference)),
    onRemoveGroupRule: (groupId: string, reference: string) =>
      dispatch(removeGroupRule(groupId, reference)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch((actions.showDialog as any)(type, title, content, dialogActions)),
  };
}

export default withTranslation(['common', NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(
    GroupEditor) as any) as React.ComponentClass<{}>;
