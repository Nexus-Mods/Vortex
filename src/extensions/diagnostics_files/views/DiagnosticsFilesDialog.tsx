import FlexLayout from '../../../controls/FlexLayout';
import { Icon as TooltipIcon, IconButton } from '../../../controls/TooltipControls';
import { IExtensionContext } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';

import { ILog, ISession } from '../types/ISession';
import { loadVortexLogs } from '../util/loadVortexLogs';

import { setLogSessions } from '../actions/session';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Button, Jumbotron, ListGroup, ListGroupItem, Modal, Panel } from 'react-bootstrap';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
  context: IExtensionContext;
}

interface IComponentState {
  textLog: string;
  logErrors: ILog[];
  sessionKey: number;
}

interface IConnectedProps {
  logSessions: ISession[];
}

interface IActionProps {
  onSetLogSessions: (logSessions: ISession[]) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class DiagnosticsFilesDialog extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      textLog: '',
      logErrors: [],
      sessionKey: -1,
    };
  }

  public componentWillReceiveProps(nextProps: IProps) {
    const { logSessions, onSetLogSessions } = this.props;

    if (logSessions !== nextProps.logSessions) {
      onSetLogSessions(nextProps.logSessions);
    }
  }

  public componentWillMount() {
    const { onSetLogSessions } = this.props;

    loadVortexLogs()
      .then((sessions) => {
        onSetLogSessions(sessions);
      })
      .catch((err) => {
        log('error', 'failed to read logs files', err.message);
      });
  }

  public render(): JSX.Element {
    const { t, logSessions, visible } = this.props;
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
      <Modal bsSize='lg' show={visible} onHide={this.resetDetail}>
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
      sessionKey: { $set: -1 },
    }));
    this.props.onHide();
  }

  private renderSessions = (session: ISession, index: number) => {
    const { logSessions, t } = this.props;
    const { sessionKey } = this.state;

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

    let sessionText: string = t('From ') + from + t(' to ') + to;
    switch (true) {
      case errors.length > 1:
        sessionText = sessionText + ' - ' + t('Errors:') + errors.length; break;
      case errors.length === 1:
        sessionText = sessionText + ' - ' + t('Error:') + errors.length; break;
    }

    return (
      <span className={classes.join(' ')} style={{ display: 'flex' }} key={index}>
        <div style={{ flex: '1 1 0' }}>
          {sessionText}
          <span style={{color: 'orange'}}>
            {isCrashed}
            </span>
        </div>
        <div className='diagnostics-files-actions'>
          <IconButton
            className='btn-embed'
            id={index.toString()}
            tooltip={t('Show full log')}
            onClick={this.showDetail}
            icon='eye'
            value='LOG'
          />
          {errors.length > 0 ? (
            <IconButton
              className='btn-embed'
              id={index.toString()}
              tooltip={t('Show errors')}
              onClick={this.showDetail}
              icon='bug'
              value='ERR'
            />
          ) : null}
          <IconButton
            className='btn-embed'
            id={index.toString()}
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
        <div>
          <p>{t('Errors')}</p>
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
        </div>
      );
    } else if (textLog !== '') {
      return (
        <div>
          <p>{t('Full log')}</p>
          <textarea
            value={textLog}
            id='textarea-diagnostics-files'
            className='textarea-diagnostics-files'
            key={textLog}
            readOnly={true}
          />
        </div>
      );
    }
  }

  private showDetail = (evt) => {
    const { logSessions } = this.props;
    const key = parseInt(evt.currentTarget.id, 10);
    const section = evt.currentTarget.value;
    const logs = logSessions[key].logs.filter((element) => element.type === 'ERROR');

    this.setState(update(this.state, {
      textLog: section === 'ERR' ? { $set: '' } : { $set: logSessions[key].fullLog },
      logErrors: section === 'ERR' ? { $set: logs } : { $set: [] },
      sessionKey: { $set: key },
    }));
  }

  private reportLog = (evt) => {
    const { logSessions } = this.props;
    const key = evt.currentTarget.id;

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');

    fs.writeFileAsync(nativeCrashesPath + '\\session.log', logSessions[key].fullLog)
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
    const { logSessions } = this.props;
    const key = evt.currentTarget.id;

    this.setState(update(this.state, {
      activeSession: { $set: key },
      textLog: { $set: logSessions[key].logs },
    }));
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    logSessions: state.session.diagnosticsFiles.logSessions,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetLogSessions: (logSessions: ISession[]) => dispatch(setLogSessions(logSessions)),
  };
}

export default translate(['common'], { wait: true })(
  (connect(mapStateToProps, mapDispatchToProps)
    (DiagnosticsFilesDialog))) as React.ComponentClass<{ IBaseProps }>;
