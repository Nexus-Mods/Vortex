import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import { IconButton } from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';

import { ILog, ISession } from '../types/ISession';
import { loadVortexLogs } from '../util/loadVortexLogs';

import * as Promise from 'bluebird';
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
  language: string;
}

interface IComponentState {
  sessionIdx: number;
  show: {
    error: boolean;
    warning: boolean;
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
  private mIsMounted: boolean = false;

  constructor(props) {
    super(props);
    this.state = {
      sessionIdx: -1,
      show: {
        error: true,
        warning: true,
        info: true,
        debug: false,
      },
      logSessions: undefined,
    };
  }

  public componentWillReceiveProps(nextProps: IProps) {
    const { onShowError } = this.props;
    const { logSessions } = this.state;

    if (!this.props.visible && nextProps.visible) {
      this.setState(update(this.state, {
        sessionKey: { $set: -1 },
        show: { $set: {
          error: true,
          warning: true,
          info: true,
          debug: false,
        } },
      }));

      this.updateLogs();
    }
  }

  public componentWillMount() {
    const { logSessions } = this.state;
    const { onShowError } = this.props;

    this.mIsMounted = true;
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public render(): JSX.Element {
    const { t, visible } = this.props;
    const { logSessions } = this.state;

    let body: JSX.Element;

    if (visible) {
      if (logSessions === undefined) {
        body = (
          <Modal.Body id='diagnostics-files'>
            <Icon name='spinner' pulse/>
          </Modal.Body>
        );
      } else if (logSessions.length > 0) {
        const sessionsSorted = logSessions
          .sort((lhs, rhs) => rhs.from.getTime() - lhs.from.getTime());

        body = (
          <Modal.Body id='diagnostics-files'>
            <FlexLayout.Fixed>
              <ListGroup className='diagnostics-files-sessions-panel'>
                {sessionsSorted.map(this.renderSession)}
              </ListGroup>
            </FlexLayout.Fixed>
            {this.renderLog()}
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
        {errors.length > 0 ? <span>
          {' - ' + t('{{ count }} error', { count: errors.length })}
        </span> : null}
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
        {['debug', 'info', 'warning', 'error'].map(type => (
          <div>
            <Checkbox
              key={`checkbox-${type}`}
              className={`log-filter-${type}`}
              checked={show[type]}
              onClick={this.toggleFilter}
              value={type}
            >
              {t(type.toUpperCase())}
            </Checkbox>
          </div>
        )) }
        <FlexLayout.Flex/>
        <Button onClick={this.copyToClipboard}>
          {t('Copy to Clipoard')}
        </Button>
        {errors.length > 0 ? (
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
        {' - '}
        <span className={`log-type-${line.type}`}>{line.type}</span>
        {': '}
        <span className='log-text'>{line.text}</span>
      </li>
    );
  }

  private renderLog() {
    const { logSessions, sessionIdx, show } = this.state;

    if (sessionIdx === -1) {
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
        onShowError('Failed to read Vortex logs', err.message);
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
      .join('\n');
    remote.clipboard.writeText(filteredLog);
  }

  private reportLog = (evt) => {
    const { onShowError } = this.props;
    const { logSessions, sessionIdx } = this.state;

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp');
    const fullLog: string = logSessions[sessionIdx].logs
      .map(line => `${line.time} - ${line.type}: ${line.text}`)
      .join('\n');

    this.props.onHide();
    const logPath = path.join(nativeCrashesPath, 'session.log');
    fs.writeFileAsync(logPath, fullLog)
      .then(() => {
        this.context.api.events.emit('report-log-error', logPath);
      })
      .catch((err) => {
        onShowError('Failed to write log session file', err.message);
      })
      .then(() => null);
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

function mapStateToProps(state: IState): IConnectedProps {
  return {
    language: state.settings.interface.language,
  };
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
