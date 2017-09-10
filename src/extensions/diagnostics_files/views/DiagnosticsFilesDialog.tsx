import FlexLayout from '../../../controls/FlexLayout';
import { Icon as TooltipIcon, IconButton } from '../../../controls/TooltipControls';
import { IExtensionContext } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';

import { ILog, ISession } from '../types/ISession';
import { loadVortexLogs } from '../util/loadVortexLogs';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import {
  Button, Checkbox, Jumbotron, ListGroup,
  ListGroupItem, Modal, Panel,
} from 'react-bootstrap';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
}

interface IComponentState {
  textLog: string;
  sessionKey: number;
  checkboxError: boolean;
  checkboxWarning: boolean;
  checkboxInfo: boolean;
  checkboxDebug: boolean;
  logSessions: ISession[];
}

interface IActionProps {
  onShowError: (message: string, details?: string | Error) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class DiagnosticsFilesDialog extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      textLog: '',
      sessionKey: -1,
      checkboxError: true,
      checkboxWarning: true,
      checkboxInfo: true,
      checkboxDebug: true,
      logSessions: [],
    };
  }

  public componentWillReceiveProps(nextProps: IProps) {
    const { onShowError } = this.props;
    const { logSessions } = this.state;

    if (nextProps.visible) {
      loadVortexLogs()
        .then((sessions) => {
          this.setState(update(this.state, {
            logSessions: { $set: sessions },
          }));
        })
        .catch((err) => {
          onShowError('Failed to read Vortex logs', err.message);
        });
    }

    if (this.props.visible !== nextProps.visible) {
      this.setState(update(this.state, {
        textLog: { $set: '' },
        sessionKey: { $set: -1 },
        checkboxInfo: { $set: true },
        checkboxError: { $set: true },
        checkboxDebug: { $set: true },
        checkboxWarning: { $set: true },
      }));
    }
  }

  public componentWillMount() {
    const { logSessions } = this.state;
    const { onShowError } = this.props;

    loadVortexLogs()
      .then((sessions) => {
        this.setState(update(this.state, {
          logSessions: { $set: sessions },
        }));
      })
      .catch((err) => {
        onShowError('Failed to read Vortex logs files', err.message);
      });
  }

  public render(): JSX.Element {
    const { t, visible } = this.props;
    const { logSessions } = this.state;
    let body = null;

    if (visible) {
      if (logSessions.length > 0) {
        body = (
          <Modal.Body id='diagnostics-files'>
            <div style={{ marginTop: 5, marginBottom: 5 }}>
              <div className='diagnostics-files-sessions-panel'>
                {logSessions.map((session, index) => this.renderSessions(session, index))}
              </div>
            </div>
            <div style={{ marginTop: 5, marginBottom: 5 }}>
              {this.renderDetail()}
            </div>
          </Modal.Body>
        );
      } else {
        body = (
          <Modal.Body id='diagnostics-files'>
            <Jumbotron>
              <div style={{ fontSize: 'medium', margin: '0 1em' }}>
                {t('An error occurred loading Vortex logs.')}
              </div>
            </Jumbotron>
          </Modal.Body>
        );
      }
    }

    return (
      <Modal bsSize='lg' show={visible} onHide={this.props.onHide}>
        <Modal.Header>
          <Modal.Title>
            {t('Diagnostics Files')}
          </Modal.Title>
        </Modal.Header>
        {body}
        <Modal.Footer>
          <Button
            id='close'
            onClick={this.props.onHide}
          >
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderSessions = (session: ISession, index: number) => {
    const { t } = this.props;
    const { logSessions, sessionKey } = this.state;

    const errors = session.logs.filter((item) =>
      item.type === 'ERROR');
    const from = session.from;
    const to = session.to;

    let isCrashed = '';
    if (session.logs[Object.keys(session.logs).length - 2] !== undefined) {
      if (session.logs[Object.keys(session.logs).length - 2].type === 'ERROR') {
        isCrashed = ' - Crashed! ';
      }
    }

    const classes = ['list-group-item'];
    if ((sessionKey > -1) && (sessionKey === index)) {
      classes.push('active');
    }

    const sessionText = (
      <div style={{ width: '90%' }}>
        <span>{t('From ')}</span>
        <span style={{ color: 'green', fontWeight: 'bold' }}>{from}</span>
        <span>{t(' to ')}</span>
        <span style={{ color: 'green', fontWeight: 'bold' }}>{to}</span>
        {errors.length > 1 ? <span>{' - ' + t('Errors:') + errors.length}</span> : undefined}
        {errors.length === 1 ? <span>{' - ' + t('Error:') + errors.length}</span> : undefined}
        <span style={{ color: 'orange' }}>{isCrashed}</span>
      </div>
    );

    return (
      <span
        className={classes.join(' ')}
        style={{ display: 'flex' }}
        key={index}
        onClick={this.showDetail}
        id={index.toString()}
      >
        <div style={{ flex: '1 1 0' }}>
          {sessionText}
        </div>
        <div className='diagnostics-files-actions'>
          {errors.length > 0 ? (
            <IconButton
              className='btn-embed'
              id={index.toString()}
              tooltip={t('Report log')}
              onClick={this.reportLog}
              icon='message'
            />
          ) : null}
        </div>
      </span>
    );
  }

  private renderDetail = () => {
    const { t } = this.props;
    const {
      sessionKey, checkboxDebug, checkboxError, checkboxInfo,
      checkboxWarning, textLog } = this.state;

    if (sessionKey > -1) {
      return (
        <div>
          <p>{t('Full log')}</p>
          <div style={{ display: 'inline-flex', flexDirection: 'row' }}>
            <span>
              <Checkbox
                key='checkboxInfo'
                checked={checkboxInfo}
                onClick={this.showDetail}
                value='INFO'
                style={{ color: 'green', padding: '5px', verticalAlign: 'middle' }}
              >{t('INFO')}
              </Checkbox>
            </span>
            <span>
              <Checkbox
                key='checkboxDebug'
                checked={checkboxDebug}
                onClick={this.showDetail}
                value='DEBUG'
                style={{ color: 'yellow', padding: '5px' }}
              >{t('DEBUG')}
              </Checkbox>
            </span>
            <span>
              <Checkbox
                key='checkboxWarning'
                checked={checkboxWarning}
                onClick={this.showDetail}
                value='WARNING'
                style={{ color: 'orange', padding: '5px' }}
              >{t('WARNING')}
              </Checkbox>
            </span>
            <span>
              <Checkbox
                key='checkboxError'
                checked={checkboxError}
                onClick={this.showDetail}
                value='ERROR'
                style={{ color: 'red', padding: '5px' }}
              >{t('ERROR')}
              </Checkbox>
            </span>
          </div>
          <div>
            <textarea
              value={textLog}
              id='textarea-diagnostics-files'
              className='textarea-diagnostics-files'
              key={textLog}
              readOnly={true}
            />
          </div>
        </div>
      );
    } else {
      return null;
    }
  }

  private updateTextArea = (key: number, filter: string) => {
    const { logSessions } = this.state;
    let checkboxError = this.state.checkboxError;
    let checkboxDebug = this.state.checkboxDebug;
    let checkboxInfo = this.state.checkboxInfo;
    let checkboxWarning = this.state.checkboxWarning;

    let logs: ILog[] = [];

    if (filter !== undefined) {
      switch (filter) {
        case 'INFO': checkboxInfo = !this.state.checkboxInfo; break;
        case 'DEBUG': checkboxDebug = !this.state.checkboxDebug; break;
        case 'ERROR': checkboxError = !this.state.checkboxError; break;
        case 'WARNING': checkboxWarning = !this.state.checkboxWarning; break;
      }
    }

    if (checkboxError) {
      logs = logs.concat(logSessions[key].logs.filter((element) => {
        if (element.type === 'ERROR') {
          return element.text;
        }
      }));
    }
    if (checkboxWarning) {
      logs = logs.concat(logSessions[key].logs.filter((element) => {
        if (element.type === 'WARNING') {
          return element.text;
        }
      }));
    }
    if (checkboxDebug) {
      logs = logs.concat(logSessions[key].logs.filter((element) => {
        if (element.type === 'DEBUG') {
          return element.text;
        }
      }));
    }
    if (checkboxInfo) {
      logs = logs.concat(logSessions[key].logs.filter((element) => {
        if (element.type === 'INFO') {
          return element.text;
        }
      }));
    }

    let textLog: string[] = [];
    logs.forEach(element => {
      textLog = textLog.concat(element.text).sort((lhs: string, rhs: string) =>
        lhs.localeCompare(rhs));
    });

    this.setState(update(this.state, {
      textLog: { $set: textLog.join('\r\n') },
      sessionKey: { $set: key },
      checkboxError: {
        $set: filter === 'ERROR' ? !this.state.checkboxError : this.state.checkboxError,
      },
      checkboxDebug: {
        $set: filter === 'DEBUG' ? !this.state.checkboxDebug : this.state.checkboxDebug,
      },
      checkboxInfo: {
        $set: filter === 'INFO' ? !this.state.checkboxInfo : this.state.checkboxInfo,
      },
      checkboxWarning: {
        $set: filter === 'WARNING' ? !this.state.checkboxWarning
          : this.state.checkboxWarning,
      },
    }));
  }

  private showDetail = (evt) => {
    const { sessionKey } = this.state;
    const filter = evt.currentTarget.value;
    let key: number = -1;
    filter !== undefined ? key = sessionKey : key = parseInt(evt.currentTarget.id, 10);
    this.updateTextArea(key, filter);
  }

  private reportLog = (evt) => {
    const { onShowError } = this.props;
    const { logSessions } = this.state;
    const { textLog } = this.state;
    const key = evt.currentTarget.id;
    let fullLog: string = '';

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp');
    if (textLog === '') {
      let textList: string[] = [];
      logSessions[key].logs.forEach(element => {
        textList = textList.concat(element.text);
      });
      fullLog = textList.join('\r\n');
    } else {
      fullLog = textLog;
    }

    this.props.onHide();
    fs.writeFileAsync(path.join(nativeCrashesPath, 'session.log'), fullLog)
      .then(() => {
        this.context.api.events.emit('report-log-error',
          path.join(nativeCrashesPath, 'session.log'));
      })
      .catch((err) => {
        onShowError('Failed to write log session file', err.message);
      });
  }

  private showSession = (evt) => {
    const { logSessions } = this.state;
    const key = evt.currentTarget.id;

    this.setState(update(this.state, {
      activeSession: { $set: key },
      textLog: { $set: logSessions[key].logs },
    }));
  }
}

function mapStateToProps(state): IConnectedProps {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details?: string | Error) =>
      showError(dispatch, message, details),
  };
}

export default translate(['common'], { wait: true })(
  (connect(mapStateToProps, mapDispatchToProps)
    (DiagnosticsFilesDialog))) as React.ComponentClass<{ IBaseProps }>;
