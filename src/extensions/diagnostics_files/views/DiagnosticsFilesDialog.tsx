import FlexLayout from '../../../controls/FlexLayout';
import { Icon as TooltipIcon, IconButton } from '../../../controls/TooltipControls';
import { IExtensionContext } from '../../../types/IExtensionContext';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';

import { ILog, ISession } from '../types/ISession';
import { loadVortexLogs } from '../util/loadVortexLogs';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem, Modal, Panel } from 'react-bootstrap';

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
  context: IExtensionContext;
}

interface IComponentState {
  sessions: ISession[];
  textLog: string;
  logErrors: ILog[];
}

type IProps = IBaseProps;

class DiagnosticsFilesDialog extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      sessions: [],
      textLog: '',
      logErrors: [],
    };
  }

  public componentWillMount() {
    loadVortexLogs()
      .then((sessionArray) => {
        this.setState(update(this.state, {
          sessions: { $set: sessionArray },
        }));
      })
      .catch((err) => {
        log('error', 'failed to read logs files', err.message);
      });
  }

  public render(): JSX.Element {
    const { t, shown } = this.props;
    const { sessions, textLog } = this.state;

    let body = null;

    if (shown) {

      body = (
        <Modal.Body id='diagnostics-files'       >
          <div style={{ marginTop: 5, marginBottom: 5 }}>
            <div className='diagnostics-files-sessions-panel'>
              {Object.keys(sessions).map((key) => this.renderSession(key))}
            </div>
          </div>
          <div style={{ marginTop: 5, marginBottom: 5 }}>
            {this.renderDetail()}
          </div>
        </Modal.Body>
      );
    }

    return (
      <Modal bsSize='lg' show={shown} onHide={this.resetDetail}>
        <Modal.Header>
          <Modal.Title>
            {t('Diagnostics Files')}
          </Modal.Title>
        </Modal.Header>
        {body}
        <Modal.Footer>
          <Button
            id='close'
            onClick={this.resetDetail}
          >
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private resetDetail = () => {
    this.setState(update(this.state, {
      logErrors: { $set: [] },
      textLog: { $set: '' },
    }));
    this.props.onHide();
  }

  private renderSession = (key: string) => {
    const { t } = this.props;
    const { sessions } = this.state;

    const errors = sessions[key].logs.filter((item) =>
      item.type === 'ERROR');
    const from = sessions[key].from;
    const to = sessions[key].to;

    let isCrashed = '';
    if (sessions[key].logs[Object.keys(sessions[key].logs).length - 2] !== undefined) {
      if (sessions[key].logs[Object.keys(sessions[key].logs).length - 2].type === 'ERROR') {
        isCrashed = '- Crashed! ';
      }
    }

    return (
      <span style={{ display: 'flex' }} key={key}>
        <div style={{ flex: '1 1 0' }}>
          <h4>
            {'From ' + from + ' to ' + to + ' - Errors: ' + errors.length + isCrashed}
          </h4>
        </div>
        <div className='diagnostics-files-actions'>
          <IconButton
            className='btn-embed'
            id={key}
            tooltip={t('Show full log')}
            onClick={this.showDetail}
            icon='eye'
            value='LOG'
          />
          {errors.length > 0 ? (
            <IconButton
              className='btn-embed'
              id={key}
              tooltip={t('Show errors')}
              onClick={this.showDetail}
              icon='bug'
              value='ERR'
            />
          ) : null}
          <IconButton
            className='btn-embed'
            id={key}
            tooltip={t('Report log')}
            onClick={this.reportLog}
            icon='message'
          />
        </div>
      </span>
    );
  }

  private renderDetail = () => {
    const { t } = this.props;
    const { textLog, logErrors } = this.state;

    if (logErrors.length > 0) {
      return (
        <ListGroup className='diagnostics-files-log-panel'>
          {
            Object.keys(logErrors).map((logKey) => {
              return (
                <ListGroupItem
                  key={logKey}
                >
                  {logErrors[logKey].text}
                </ListGroupItem>
              );
            })
          }
        </ListGroup>
      );
    } else if (textLog !== '') {
      return (
        <div>
          <textarea
            value={textLog}
            id='textarea-diagnostics-files'
            className='textarea-diagnostics-files'
          />
        </div>
      );
    }
  }

  private showDetail = (evt) => {
    const { textLog, sessions } = this.state;
    const key = evt.currentTarget.id;

    const detail = evt.currentTarget.value;

    if (detail === 'ERR') {
      const logs = sessions[key].logs.filter((element) => element.type === 'ERROR');

      this.setState(update(this.state, {
        textLog: { $set: '' },
        logErrors: { $set: logs },
      }));
    } else if (detail === 'LOG') {
      this.setState(update(this.state, {
        logErrors: { $set: [] },
        textLog: { $set: sessions[key].fullLog },
      }));
    }
  }

  private reportLog = (evt) => {
    const { textLog, sessions } = this.state;
    const key = evt.currentTarget.id;

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');

    fs.writeFileAsync(nativeCrashesPath + '\\session.log', sessions[key].fullLog)
      .then(() => {
        this.resetDetail();
        this.context.api.events.emit('report-log-error',
          path.join(nativeCrashesPath, 'session.log'));
        this.props.onHide();
      })
      .catch((err) => {
        log('error', 'failed to write log session file', err.message);
      });
  }

  private showSession = (evt) => {
    const { textLog, sessions } = this.state;
    const key = evt.currentTarget.id;

    this.setState(update(this.state, {
      activeSession: { $set: key },
      textLog: { $set: sessions[key].logs },
    }));
  }

}

export default
  translate(['common'], { wait: false })(
    DiagnosticsFilesDialog) as React.ComponentClass<IBaseProps>;
