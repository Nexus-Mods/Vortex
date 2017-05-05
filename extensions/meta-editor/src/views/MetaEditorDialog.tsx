import { setShowMetaEditor } from '../actions';

import RuleEditor from './RuleEditor';

import { ILookupResult, IModInfo, IReference, IRule, RuleType } from 'modmeta-db';
import { ComponentEx, FormFeedbackAwesome, Icon, log, selectors, tooltip, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import update = require('react-addons-update');
import { ControlLabel, FormControl, FormGroup,
         ListGroup, ListGroupItem, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import semver = require('semver');
import * as url from 'url';
import * as nodeUtil from 'util';

interface IConnectedProps {
  downloads: { [id: string]: any };
  downloadPath: string;
  visibleId: string;
}

interface IActionProps {
  onHide: () => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  info: IModInfo;
  showRuleEditor: boolean;
}

class MetaEditorDialog extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      info: undefined,
      showRuleEditor: false,
    });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.visibleId !== nextProps.visibleId) {
      this.retrieveInfo(nextProps.visibleId);
    }
  }

  public render(): JSX.Element {
    const { t, visibleId } = this.props;
    const { info, showRuleEditor } = this.state;

    if (info === undefined) {
      return null;
    }

    const fvState = semver.valid(info.fileVersion) === null ? 'error' : 'success';
    const urlState = url.parse(info.sourceURI).host === null ? 'error' : 'success';

    return (
      <Modal show={info !== undefined} onHide={this.close}>
        <Modal.Header><h3>{info.logicalFileName}</h3></Modal.Header>
        <Modal.Body>
          <form>
            <FormGroup
              controlId='form-meta-edit'
            >
              <ControlLabel>{t('Mod Name')}</ControlLabel>
              <FormControl
                type='text'
                value={info.modName}
                onChange={this.changeModName}
              />
            </FormGroup>
            <FormGroup>
              <ControlLabel>{t('Mod ID')}</ControlLabel>
              <FormControl
                type='text'
                value={info.modId}
                onChange={this.changeModId}
              />
            </FormGroup>
            <FormGroup>
              <ControlLabel>{t('File Name')}</ControlLabel>
              <FormControl
                type='text'
                value={info.logicalFileName}
                onChange={this.changeLogicalFileName}
              />
            </FormGroup>
            <FormGroup
              validationState={fvState as 'error' | 'success'}
            >
              <ControlLabel>{t('File Version')}</ControlLabel>
              <FormControl
                type='text'
                value={info.fileVersion}
                onChange={this.changeFileVersion}
              />
              <FormFeedbackAwesome />
            </FormGroup>
            <FormGroup
              validationState={urlState as 'error' | 'success'}
            >
              <ControlLabel>{t('Source URL')}</ControlLabel>
              <FormControl
                type='text'
                value={info.sourceURI}
                onChange={this.changeSourceURI}
              />
              <FormFeedbackAwesome />
            </FormGroup>
            <FormGroup>
              <ControlLabel>
                {t('Rules')}
                {' '}
                <tooltip.Button
                  className='btn-embed'
                  tooltip={t('Add')}
                  id='add-rule'
                  onClick={this.showRuleEditor}
                >
                  <Icon name='plus' />
                </tooltip.Button>
              </ControlLabel>
              <ListGroup>
                {info.rules !== undefined ? info.rules.map(this.renderRule) : null}
              </ListGroup>
            </FormGroup>
          </form>
          <RuleEditor
            fileName={info.logicalFileName}
            show={showRuleEditor}
            onHide={this.hideRuleEditor}
            onConfirm={this.addRule}
          />
        </Modal.Body>
        <Modal.Footer>
          <tooltip.Button
            id='cancel-meta-btn'
            tooltip={t('Cancel')}
            onClick={this.cancel}
          >
            {t('Cancel')}
          </tooltip.Button>
          <tooltip.Button
            id='save-meta-btn'
            tooltip={t('Save in local DB')}
            onClick={this.save}
          >
            {t('Save')}
          </tooltip.Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderRule = (rule: IRule, index: number) => {
    const { t } = this.props;
    return (
      <ListGroupItem
        key={`rule-${index}`}
      >
        {rule.type} - {this.renderReference(rule.reference)}
        <div className='rule-actions pull-right'>
          <tooltip.Button
            id={`rule-${index}`}
            tooltip={t('Remove')}
            onClick={this.removeRule}
          >
            <Icon name='remove'/>
          </tooltip.Button>
        </div>
      </ListGroupItem>
    );
  }

  private renderReference = (reference: IReference) => {
    if (reference.fileMD5 !== undefined) {
      return reference.fileMD5;
    } else {
      return `${reference.modId}:${reference.logicalFileName} - ${reference.versionMatch}`;
    }
  }
  private getEmptyData(filePath?: string, fileInfo?: any): IModInfo {
    const fileName = filePath !== undefined
      ? path.basename(filePath, path.extname(filePath))
      : '';
    const modName = filePath !== undefined
      ? path.basename(filePath, path.extname(filePath))
      : '';
    return {
      modId: '',
      modName,
      fileName,
      fileSizeBytes: fileInfo !== undefined ? fileInfo.size : 0,
      gameId: '',
      fileVersion: '',
      fileMD5: fileInfo !== undefined ? fileInfo.fileMD5 : '',
      sourceURI: '',
      rules: [],
      details: {},
    };
  }

  private retrieveInfo(downloadId: string) {
    if (downloadId === undefined) {
      this.nextState.info = undefined;
      return;
    }

    const { downloads, downloadPath } = this.props;
    const filePath = path.join(downloadPath, downloads[downloadId].localPath);

    this.context.api.sendNotification({
      id: 'meta-lookup',
      type: 'activity',
      message: 'Mod lookup...',
    });

    this.context.api.lookupModMeta({
      filePath,
      fileMD5: downloads[downloadId].fileMD5,
      fileSize: downloads[downloadId].size,
     })
      .then((info: ILookupResult[]) => {
        if (info.length > 0) {
          this.nextState.info = info[0].value;
        } else {
          this.nextState.info = this.getEmptyData(filePath, downloads[downloadId]);
        }
        return Promise.resolve();
      })
      .catch((err) => {
        log('info', 'Failed to look up mod meta information',
            { err: nodeUtil.inspect(err) });
        this.nextState.info = this.getEmptyData(filePath, downloads[downloadId]);
      })
      .finally(() => {
        this.context.api.dismissNotification('meta-lookup');
      });
  }

  private removeRule = (evt) => {
    const idSegmented = evt.currentTarget.id.split('-');
    const idx = idSegmented[idSegmented.length - 1];
    this.setState(update(this.state, { info: {
      rules: { $splice: [[ idx, 1 ]] },
    }}));
  }

  private addRule = (type: RuleType, reference: IReference) => {
    const rule = { type, reference };
    this.setState(util.pushSafe(this.state, [ 'info', 'rules' ], rule), () => {
      this.hideRuleEditor();
    });
  }

  private save = () => {
    this.context.api.saveModMeta(this.state.info);
    this.close();
  }

  private cancel = () => {
    this.close();
  }

  private showRuleEditor = () => {
    this.setState(update(this.state, {
      showRuleEditor: { $set: true },
    }));
  }

  private hideRuleEditor = () => {
    this.setState(update(this.state, {
      showRuleEditor: { $set: false },
    }));
  }

  private setField(key: string, value: any) {
    this.setState(update(this.state, { info: {
      [key]: { $set: value },
    }}));
  }

  private changeModName = (event) => {
    this.setField('modName', event.target.value);
  }

  private changeModId = (event) => {
    this.setField('modId', event.target.value);
  }

  private changeLogicalFileName = (event) => {
    this.setField('logicalFileName', event.target.value);
  }

  private changeFileVersion = (event) => {
    this.setField('fileVersion', event.target.value);
  }

  private changeSourceURI = (event) => {
    this.setField('sourceURI', event.target.value);
  }

  private close = () => {
    this.props.onHide();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
    visibleId: state.session.metaEditor.showDialog,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onHide: () => dispatch(setShowMetaEditor(undefined)),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(
    MetaEditorDialog)) as React.ComponentClass<{}>;
