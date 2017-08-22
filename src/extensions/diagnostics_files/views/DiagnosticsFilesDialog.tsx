import FlexLayout from '../../../controls/FlexLayout';
import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';

import { ILog, ISession } from '../types/ISession';

import { clipboard, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem, Modal, Panel } from 'react-bootstrap';

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
}

interface IComponentState {
  sessions: ISession[];
  textLog: ILog[];
  activeSession: string;
}

type IProps = IBaseProps;

class DiagnosticsFilesDialog extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;
  constructor(props) {
    super(props);
    this.mMounted = false;
    this.state = {
      sessions: [],
      textLog: [],
      activeSession: '',
    };
  }

  public componentWillMount() {
    this.loadVortexLogs();
  }

  public componentDidMount() {
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t, shown } = this.props;
    const { sessions, textLog } = this.state;

    let body = null;

    if (shown) {

      body = (
        <Modal.Body id='diagnostics-files' >
          <div style={{ marginTop: 5, marginBottom: 5 }}><p><strong>{t('Sessions')}</strong></p>
            <ListGroup className='diagnostics-files-sessions-panel'>
              {Object.keys(sessions).map((key) => this.renderSession(key))}
            </ListGroup>
          </div>
          <div style={{ marginTop: 5, marginBottom: 5 }}><p><strong>{t('Log')}</strong></p>
            <ListGroup className='diagnostics-files-log-panel'>
              {
                Object.keys(textLog).map((key) => this.renderLog(key))
              }
            </ListGroup>
          </div>
        </Modal.Body>
      );
    }

    return (
      <Modal show={shown} onHide={this.props.onHide}>
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

  private loadVortexLogs = () => {
    const { sessions } = this.state;

    const logPath = remote.app.getPath('userData');
    const sessionArray: ISession[] = [];

    fs.readdirAsync(logPath)
      .then(data => {
        data.forEach(file => {
          if (path.extname(file) === '.log') {
            fs.readFileAsync(path.join(logPath, file), 'utf8')
              .then(text => {
                const splittedSessions = text.split('- info: --------------------------');

                splittedSessions.forEach((sessionElement, sessionIndex) => {

                  const splittedLogs = sessionElement.split('\r\n');
                  const logArray: ILog[] = [];

                  splittedLogs.forEach(element => {
                    let textType = '';
                    if (element.toLowerCase().indexOf('- error:') > -1) {
                      textType = 'ERROR';
                    }

                    logArray.push({
                      text: element,
                      type: textType,
                    });

                  });

                  sessionArray.push({
                    from: sessionElement !== undefined ? sessionElement.substring(0, 30) : '',
                    to: splittedSessions[sessionIndex + 1] !== undefined ?
                      splittedSessions[sessionIndex + 1].substring(0, 30) :
                      splittedLogs[splittedLogs.length - 2].substring(0, 30),
                    logs: logArray,
                  });
                });
              });
          }
        });
      })
      .then(() => {
        this.setState(update(this.state, {
          sessions: {
            $set: sessionArray,
          },
        }));
      })
      .catch((err) => {
        log('error', 'failed to read logs files', err.message);
      });
  }

  private renderSession = (key: string) => {
    const { t } = this.props;
    const { activeSession, sessions } = this.state;

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
      <ListGroupItem
        key={sessions[key].from}
        active={activeSession === key}
      >
        <div>{'From ' + from + ' to ' + to}</div>
        {errors.length > 0 ?
          <div style={{ color: 'orange' }}>
            {'( Errors: ' + errors.length + ' ' + isCrashed + ')'}
          </div> : null
        }
        <IconButton
          className='btn-embed btn-line-right'
          id={key}
          tooltip={t('Show log')}
          onClick={this.showSession}
          icon='eye'
        />
      </ListGroupItem>
    );
  }

  private copyToClipboard = (evt) => {
    const { textLog } = this.state;
    const key = evt.currentTarget.id;

    clipboard.writeText(textLog[key].text);
  }

  private renderLog = (key: string) => {
    const { t } = this.props;
    const { textLog } = this.state;

    let textColor = '';

    if (textLog[key].type === 'ERROR') {
      textColor = 'red';
    }

    return (

      <ListGroupItem
        key={key}
      >
        {textLog[key].type === 'ERROR' ?
          <div>
            <IconButton
              className='btn-embed btn-line-top'
              id={key}
              tooltip={t('Copy error text')}
              onClick={this.copyToClipboard}
              icon='clone'
            />
            <Panel bsStyle='danger' collapsible header={t('ERROR')}>
              <p key={key} style={{ color: textColor }}>
                {textLog[key].text}
              </p>

            </Panel>
          </div>
          : <p key={key} style={{ color: textColor }}>
            {textLog[key].text}
          </p>
        }

      </ListGroupItem>
    );
  }

  private showSession = (evt) => {
    const { textLog, sessions } = this.state;
    const key = evt.currentTarget.id;

    this.setState(update(this.state, {
      activeSession: {
        $set: key,
      },
      textLog: {
        $set: sessions[key].logs,
      },
    }));
  }

}

export default
  translate(['common'], { wait: false })(
    DiagnosticsFilesDialog) as React.ComponentClass<IBaseProps>;
