import {ComponentEx, translate} from '../../../util/ComponentEx';
import {Button} from '../../../views/TooltipControls';

import * as React from 'react';
import { Modal, Table } from 'react-bootstrap';

import {log} from '../../../util/log';

export type FileActionRef = 'import' | 'drop';
export type FileActionVal = 'keey';

export type FileAction = FileActionRef | FileActionVal;

export interface IFileEntry {
  filePath: string;
  source: string;
  type: 'refchange' | 'valchange';
  action: FileAction;
}

export interface IBaseProps {
  actions: IFileEntry[];
  onChangeAction: (fileName: string, action: FileAction) => void;
  onClose: (cancel: boolean) => void;
}

const nop = () => undefined;

const possibleActionsRef = [
  { key: 'import', text: 'Save modified' },
  { key: 'drop', text: 'Restore original' },
];

const possibleActionsVal = [
  { key: 'keep', text: 'Keep modified' },
];

interface IRowProps {
  t: I18next.TranslationFunction;
  entry: IFileEntry;
  onChangeAction: (fileName: string, action: FileAction) => void;
}

class ChangeRow extends React.Component<IRowProps, {}> {
  public render(): JSX.Element {
    const { entry } = this.props;

    const possibleActions = entry.type === 'refchange' ? possibleActionsRef : possibleActionsVal;

    return <tr key={entry.filePath}>
      <td>{entry.filePath}</td>
      <td>
        <select
          className='form-control'
          onChange={this.changeValue}
          value={entry.action}
        >
          {possibleActions.map((action) => this.renderChoice(action.key, action.text, entry))}
        </select>
      </td>
    </tr>;
  }

  private changeValue = (evt: React.MouseEvent<any>) => {
    const {entry, onChangeAction} = this.props;
    onChangeAction(entry.filePath, evt.currentTarget.value);
  }

  private renderChoice = (key: string, text: string, entry: IFileEntry): JSX.Element => {
    const {t} = this.props;

    return <option
      key={key}
      value={key}
    >
      {t(text)}
    </option>;
  }
}

class ExternalChangeDialog extends ComponentEx<IBaseProps, {}> {
  public render(): JSX.Element {
    const { t, actions } = this.props;

    if (actions === undefined) {
      return null;
    }

    return <Modal show={actions !== undefined} onHide={nop}>
      <Modal.Header>{t('External Changes')}</Modal.Header>
      <Modal.Body>
        {t('One or more files have been modified on disk since NMM2 last activated. '
          + 'You have to decide what happens with them.')}
        <Table>
          <tbody>
            {actions.map(this.renderRow)}
          </tbody>
        </Table>
      </Modal.Body>
      <Modal.Footer>
      <Button
        id='btn-cancel-activation'
        tooltip={t('Cancel activation')}
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
    </Modal>;
  }

  private cancel = () => {
    this.props.onClose(true);
  }

  private confirm = () => {
    this.props.onClose(false);
  }

  private renderRow = (entry: IFileEntry): JSX.Element => {
    const { t, onChangeAction } = this.props;

    return <ChangeRow entry={entry} t={t} onChangeAction={onChangeAction} />;
  }
}

export default translate(['common'], { wait: false })(
  ExternalChangeDialog) as React.ComponentClass<IBaseProps>;
