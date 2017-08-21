import FlexLayout from '../../../controls/FlexLayout';
import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';

import { ISession } from '../types/ISession';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Button, ListGroup, ListGroupItem, Modal } from 'react-bootstrap';

export interface IBaseProps {
  shown: boolean;
  onHide: () => void;
}

interface IComponentState {
  sessions: ISession[];
  textLog: string[];
}

let textColor: string = '';

type IProps = IBaseProps;

class DiagnosticsFilesDialog extends ComponentEx<IProps, IComponentState> {
  private mMounted: boolean;
  constructor(props) {
    super(props);
    this.mMounted = false;
    this.state = {
      sessions: [],
      textLog: [],
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
            <div className='diagnostics-files-sessions-panel'>
              {Object.keys(sessions).map((key) => this.renderSession(key))}
            </div>
          </div>
          <div style={{ marginTop: 5, marginBottom: 5 }}><p><strong>{t('Log')}</strong></p>
            <div className='diagnostics-files-log-panel'>
              {
                Object.keys(textLog).map((key) => this.renderLog(key))
              }
            </div>
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

                  const splittedLogs = sessionElement.split('\n');

                  sessionArray.push({
                    from: sessionElement !== undefined ? sessionElement.substring(0, 30) : '',
                    to: splittedSessions[sessionIndex + 1] !== undefined ?
                      splittedSessions[sessionIndex + 1].substring(0, 30) :
                      splittedLogs[splittedLogs.length - 2].substring(0, 30),
                    logs: splittedLogs,
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
    const { sessions } = this.state;

    const warnings = sessions[key].logs.filter((item) =>
      item.toLowerCase().indexOf('- warn:') > -1);
    const errors = sessions[key].logs.filter((item) =>
      item.toLowerCase().indexOf('- error:') > -1);
    const from = sessions[key].from;
    const to = sessions[key].to;

    return (
      <ListGroupItem
        key={sessions[key].from}
      >
        <div>{'From ' + from + ' to ' + to}</div>
        {errors.length > 0 || warnings.lenght > 0 ?
          <div style={{ color: 'orange' }}>
            {'( Errors: ' + errors.length + ' - Warnings: ' + warnings.length + ' )'}
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

  private renderLog = (key: string) => {
    const { t } = this.props;
    const { textLog } = this.state;

    if (textLog[key].toLowerCase().indexOf('- warn:') > -1) {
      textColor = 'yellow';
    } else if (textLog[key].toLowerCase().indexOf('- error:') > -1) {
      textColor = 'red';
    } else if (textLog[key].toLowerCase().indexOf('- info:') > -1) {
      textColor = '';
    } else if (textLog[key].toLowerCase().indexOf('- debug:') > -1) {
      textColor = '';
    }

    return (
      <p key={key} style={{ color: textColor }}>
        {textLog[key]}
      </p>
    );
  }

  private showSession = (evt) => {
    const { sessions } = this.state;
    const key = evt.currentTarget.id;

    this.setState(update(this.state, {
      textLog: {
        $set: sessions[key].logs,
      },
    }));
  }

}

export default
  translate(['common'], { wait: false })(
    DiagnosticsFilesDialog) as React.ComponentClass<IBaseProps>;
