import { Button } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { midClip } from '../../../util/util';

import { confirmExternalChanges, setExternalChangeAction } from '../actions/externalChanges';

import { FileAction, IFileEntry } from '../types/IFileEntry';

import * as I18next from 'i18next';
import * as React from 'react';
import { Modal, Table } from 'react-bootstrap';
import * as Redux from 'redux';

export interface IBaseProps {
}

interface IConnectedProps {
  changes: IFileEntry[];
}

interface IActionProps {
  onChangeAction: (fileNames: string[], action: FileAction) => void;
  onClose: (changes: IFileEntry[], cancel: boolean) => void;
}

interface IPossibleAction {
  key: string;
  text: string;
}

const nop = () => undefined;

const possibleActions: { [type: string]: IPossibleAction[] } = {
  refchange: [
    { key: 'import', text: 'Save modified' },
    { key: 'drop', text: 'Restore from mod' },
  ],
  valchange: [
    { key: 'keep', text: 'Keep modified' },
  ],
  deleted: [
    { key: 'restore', text: 'Restore from mod' },
    { key: 'delete', text: 'Delete in mod as well' },
  ],
};

interface IRowProps {
  t: I18next.TranslationFunction;
  entry: IFileEntry;
  onChangeAction: (fileNames: string[], action: FileAction) => void;
}

class ChangeRow extends React.Component<IRowProps, {}> {
  public render(): JSX.Element {
    const { entry } = this.props;

    const actions = possibleActions[entry.type];

    return (
      <tr key={entry.filePath}>
        <td><a className='fake-link' title={entry.filePath}>{midClip(entry.filePath, 50)}</a></td>
        <td>
          <select
            className='form-control'
            onChange={this.changeValue}
            value={entry.action}
          >
            {actions.map((action) => this.renderChoice(action.key, action.text, entry))}
          </select>
        </td>
      </tr>
    );
  }

  private changeValue = (evt: React.ChangeEvent<HTMLSelectElement>) => {
    const { entry, onChangeAction } = this.props;
    onChangeAction([entry.filePath], evt.currentTarget.value as FileAction);
  }

  private renderChoice = (key: string, text: string, entry: IFileEntry): JSX.Element => {
    const { t } = this.props;

    return (
      <option
        key={key}
        value={key}
      >
        {t(text)}
      </option>
    );
  }
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ExternalChangeDialog extends ComponentEx<IProps, {}> {
  private setAll = {
    refchange: (evt: React.MouseEvent<any>) => {
      this.setAllFunc('refchange', evt.currentTarget.href.split('#')[1]);
    },
    valchange: (evt: React.MouseEvent<any>) => {
      this.setAllFunc('valchange', evt.currentTarget.href.split('#')[1]);
    },
    deleted: (evt: React.MouseEvent<any>) => {
      this.setAllFunc('deleted', evt.currentTarget.href.split('#')[1]);
    },
  };

  public render(): JSX.Element {
    const { t, changes } = this.props;

    const visible = changes !== undefined && changes.length > 0;

    const refChanged = changes.filter((change) => change.type === 'refchange');
    const valChanged = changes.filter((change) => change.type === 'valchange');
    const deleted = changes.filter((change) => change.type === 'deleted');

    return (
      <Modal id='ext-change-dialog' show={visible} onHide={nop}>
        <Modal.Header>
          <Modal.Title>{t('External Changes')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className='padded-text' style={{ flex: 0 }} >
            {t('One or more files have been modified on disk since Vortex last deployed. '
              + 'You have to decide what happens with them.')}
          </div>

          {this.renderChanged(t('These files were modified'), 'valchange', valChanged)}
          {this.renderChanged(t('These files were replaced (or removed from the mod)'),
            'refchange', refChanged)}
          {this.renderChanged(t('These files were deleted'), 'deleted', deleted)}
        </Modal.Body>
        <Modal.Footer>
          <Button
            id='btn-cancel-activation'
            tooltip={t('Cancel deployment')}
            onClick={this.cancel}
          >
            {t('Cancel')}
          </Button>
          <Button
            id='btn-confirm-activation'
            tooltip={t('Confirm changes')}
            onClick={this.confirm}
          >
            {t('Confirm')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderChanged = (text: string, type: string, entries: IFileEntry[]) => {
    const { t } = this.props;
    if (entries.length === 0) {
      return null;
    }

    const actions = possibleActions[type];

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {text}
        <p>{actions.map((action) => (
          <a
            key={action.key}
            onClick={this.setAll[type]}
            href={'#' + action.key}
            style={{ marginRight: 10 }}
          >{t(action.text)}
          </a>
        ))
        }</p>
        <div style={{ overflowY: 'auto' }}>
          <Table>
            <tbody>
              {entries.map(this.renderRow)}
            </tbody>
          </Table>
        </div>
      </div>
    );
  }

  private setAllFunc = (changeType: string, action: FileAction) => {
    const { changes, onChangeAction } = this.props;
    onChangeAction(
      changes
        .filter((entry) => entry.type as string === changeType)
        .map((entry) => entry.filePath),
      action,
    );
  }

  private cancel = () => {
    this.props.onClose([], true);
  }

  private confirm = () => {
    this.props.onClose(this.props.changes, false);
  }

  private renderRow = (entry: IFileEntry): JSX.Element => {
    const { t, onChangeAction } = this.props;

    return (
      <ChangeRow
        key={entry.filePath}
        entry={entry}
        t={t}
        onChangeAction={onChangeAction}
      />
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    changes: state.session.externalChanges.changes,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onChangeAction: (fileName: string[], action: FileAction) =>
      dispatch(setExternalChangeAction(fileName, action)),
    onClose: (changes: IFileEntry[], cancel: boolean) =>
      dispatch(confirmExternalChanges(changes, cancel)),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(ExternalChangeDialog),
) as React.ComponentClass<IBaseProps>;
