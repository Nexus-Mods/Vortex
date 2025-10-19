import Modal from '../../../controls/Modal';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { activeGameId } from '../../../extensions/profile_management/activeGameId';
import { Button } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import * as React from 'react';
import { clearPurgeSummary, setPurgeSummaryVisible } from '../actions/session';

interface IConnectedProps {
  gameId?: string;
  visible: boolean;
  data: any;
}

interface IActionProps {
  onClose: () => void;
}

type IProps = IConnectedProps & IActionProps;

class PurgeSummaryDialog extends ComponentEx<IProps, {}> {
  public render() {
    const { t, visible, data } = this.props;
    const byType = data?.byType ?? {};
    return (
      <Modal id='purge-summary-dialog' show={visible} onHide={this.onClose}>
        <Modal.Header>
          <Modal.Title>{t('Purge Summary')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {Object.keys(byType).length === 0 && (
            <div>{t('No files were purged or nothing to report.')}</div>
          )}
          {Object.keys(byType).map(typeId => (
            <div key={typeId}>
              <h5>{t('Mod Type')}: {typeId}</h5>
              <ul>
                {(byType[typeId] || []).map((entry, idx) => (
                  <li key={idx}>{entry?.relPath || entry?.filePath || String(entry)}</li>
                ))}
              </ul>
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.onClose}>{t('Close')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private onClose = () => {
    this.props.onClose();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameId: activeGameId(state),
    visible: state.session.mods.purgeSummaryVisible,
    data: state.session.mods.purgeSummary,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onClose: () => {
      dispatch(setPurgeSummaryVisible(false));
      dispatch(clearPurgeSummary());
    },
  };
}

const ConnectedPurgeSummary = connect(mapStateToProps, mapDispatchToProps)(PurgeSummaryDialog);
export default translate(['common'])(ConnectedPurgeSummary);