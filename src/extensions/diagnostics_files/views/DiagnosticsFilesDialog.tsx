import FlexLayout from '../../../controls/FlexLayout';
import Spinner from '../../../controls/Spinner';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import { didIgnoreError, isOutdated } from '../../../util/errorHandling';
import * as fs from '../../../util/fs';
import getVortexPath from '../../../util/getVortexPath';
import { showError } from '../../../util/message';

import { ILog, ISession } from '../types/ISession';
import { loadVortexLogs } from '../util/loadVortexLogs';

import * as RemoteT from '@electron/remote';
import Promise from 'bluebird';
import update from 'immutability-helper';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import {
  Button, Checkbox, Jumbotron, ListGroup,
  ListGroupItem, Modal,
} from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import lazyRequire from '../../../util/lazyRequire';

const remote = lazyRequire<typeof RemoteT>(() => require('@electron/remote'));

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
  language: string;
}

interface IComponentState {
  sessionIdx: number;
  show: {
    error: boolean;
    warn: boolean;
    info: boolean;
    debug: boolean;
  };
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
      sessionIdx: -1,
      show: {
        error: true,
        warn: true,
        info: true,
        debug: false,
      },
      logSessions: undefined,
    };
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (!this.props.visible && nextProps.visible) {
      this.setState(update(this.state, {
        sessionIdx: { $set: -1 },
        show: { $set: {
          error: true,
          warn: true,
          info: true,
          debug: false,
        } },
      }));

      this.updateLogs();
    }
  }

  public render(): JSX.Element {
    const { t, visible } = this.props;
    const { logSessions } = this.state;

    let body: JSX.Element;

    if (visible) {
      if (logSessions === undefined) {
        body = (
          <Modal.Body id='diagnostics-files'>
            <Spinner />
          </Modal.Body>
        );
      } else if (logSessions.length > 0) {
        const sessionsSorted = logSessions
          .sort((lhs, rhs) => rhs.from.getTime() - lhs.from.getTime());

        body = (
          <Modal.Body id='diagnostics-files'>
            <FlexLayout.Flex>
              <ListGroup className='diagnostics-files-sessions-panel'>
                {sessionsSorted.map(this.renderSession)}
              </ListGroup>
            </FlexLayout.Flex>
            <FlexLayout.Flex>
              {this.renderLog()}
            </FlexLayout.Flex>
          </Modal.Body>
        );
      } else {
        body = (
          <Modal.Body id='diagnostics-files'>
            <Jumbotron className='diagnostics-files-error'>
              {t('An error occurred loading Vortex logs.')}
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

  private renderSession = (session: ISession, index: number) => {
    const { t, language } = this.props;
    const { sessionIdx } = this.state;

    const errors = session.logs.filter(item => item.type === 'error');
    const from = session.from;
    const to = session.to;

    let isCrashed = '';
    if ((session.from === undefined)
        && !session.logs[session.logs.length - 1].text.endsWith('clean application end')) {
      isCrashed = ` - ${t('Crashed')}!`;
    }

    const classes = ['list-group-item'];
    if (sessionIdx === index) {
      classes.push('active');
    }

    const sessionText = (
      <div style={{ width: '90%' }}>
        <span>{t('From') + ' '}</span>
        <span className='session-from'>{from.toLocaleString(language)}</span>
        <span>{' ' + t('to') + ' '}</span>
        <span className='session-to'>{to.toLocaleString(language)}</span>
        {errors.length > 0 ? (
          <span>
            {' - ' + t('{{ count }} error', { count: errors.length })}
          </span>
        ) : null}
        <span className='session-crashed'>{isCrashed}</span>
      </div>
    );

    return (
      <ListGroupItem
        className={classes.join(' ')}
        key={index}
        onClick={this.selectSession}
        value={index}
      >
        {sessionText}
      </ListGroupItem>
    );
  }

  private renderFilterButtons() {
    const { t } = this.props;
    const { logSessions, sessionIdx, show } = this.state;

    const errors = (sessionIdx === -1)
      ? []
      : logSessions[sessionIdx].logs.filter(item => item.type === 'error');

    return (
      <FlexLayout type='row'>
        {['debug', 'info', 'warn', 'error'].map(type => (
          <div key={type}>
            <Checkbox
              key={`checkbox-${type}`}
              className={`log-filter-${type}`}
              checked={show[type]}
              onChange={this.toggleFilter}
              value={type}
            >
              {t(type.toUpperCase())}
            </Checkbox>
          </div>
        )) }
        <FlexLayout.Flex/>
        <Button onClick={this.copyToClipboard}>
          {t('Copy to Clipboard')}
        </Button>
        {(!isOutdated() && !didIgnoreError() && (errors.length > 0)) ? (
          <Button
            id={`report-log-${sessionIdx}`}
            onClick={this.reportLog}
          >
          {t('Report')}
          </Button>
        ) : null}
      </FlexLayout>
    );
  }

  private renderLogLine(line: ILog): JSX.Element {
    return (
      <li key={line.lineno} className={`log-line-${line.type}`}>
        <span className='log-time'>{line.time}</span>
        {' - '}<span className={`log-type-${line.type}`}>{line.type.toUpperCase()}</span>{' - '}
        <span className='log-text'>{line.text}</span>
      </li>
    );
  }

  private renderLog() {
    const { logSessions, sessionIdx, show } = this.state;

    if ((sessionIdx === -1) || (logSessions[sessionIdx] === undefined)) {
      return null;
    }

    const enabledLevels = new Set(Object.keys(show).filter(key => show[key]));

    const filteredLog = logSessions[sessionIdx].logs
      .filter(line => enabledLevels.has(line.type))
      .map(this.renderLogLine);

    return (
      <FlexLayout type='column' className='diagnostics-files-log-panel'>
        <FlexLayout.Fixed>
          {this.renderFilterButtons()}
        </FlexLayout.Fixed>
        <FlexLayout.Flex>
          <ul className='log-list'>
            {filteredLog}
          </ul>
        </FlexLayout.Flex>
      </FlexLayout>
    );
  }

  private updateLogs(): Promise<void> {
    const { onShowError } = this.props;
    return loadVortexLogs()
      .then(sessions => {
        this.setState(update(this.state, {
          logSessions: { $set: sessions },
        }));
      })
      .catch((err) => {
        onShowError('Failed to read Vortex logs', err);
      });
  }

  private toggleFilter = (evt) => {
    const { show } = this.state;
    const filter = evt.currentTarget.value;
    this.setState(update(this.state, { show: { [filter]: { $set: !show[filter] } } }));
  }

  private selectSession = (evt) => {
    const idx = evt.currentTarget.value;
    this.setState(update(this.state, { sessionIdx: { $set: idx } }));
  }

  private copyToClipboard = () => {
    const { logSessions, sessionIdx, show } = this.state;

    const enabledLevels = new Set(Object.keys(show).filter(key => show[key]));

    const filteredLog = logSessions[sessionIdx].logs
      .filter(line => enabledLevels.has(line.type))
      .map(line => `${line.time} - ${line.type}: ${line.text}`)
      .join(os.EOL);
    remote.clipboard.writeText(filteredLog);
  }

  private reportLog = (evt) => {
    const { onShowError } = this.props;
    const { logSessions, sessionIdx } = this.state;

    const nativeCrashesPath = path.join(getVortexPath('userData'), 'temp');
    const fullLog: string = logSessions[sessionIdx].logs
      .map(line => `${line.time} - ${line.type}: ${line.text}`)
      .join(os.EOL);

    this.props.onHide();
    const logPath = path.join(nativeCrashesPath, 'session.log');
    fs.ensureDirWritableAsync(nativeCrashesPath, () => Promise.resolve())
      .then(() => fs.writeFileAsync(logPath, fullLog))
      .then(() => {
        this.context.api.events.emit('report-log-error', logPath);
      })
      .catch((err) => {
        if (!(err instanceof UserCanceled)) {
          onShowError('Failed to write log session file', err);
        }
      })
      .then(() => null);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string | Error) =>
      showError(dispatch, message, details),
  };
}

export default translate(['common'])(
  connect<IConnectedProps, IActionProps, IBaseProps, IState>(mapStateToProps, mapDispatchToProps)
    (DiagnosticsFilesDialog)) as React.ComponentClass<IBaseProps>;
