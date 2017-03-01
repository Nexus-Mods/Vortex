import RuleEditor from './RuleEditor';

import { ComponentEx, FormFeedbackAwesome, Icon,
         log, selectors, tooltip, types,
         util } from 'nmm-api';

import { ILookupResult, IModInfo, IReference,
         IRule, RuleType } from 'modmeta-db';
import * as path from 'path';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, ListGroup,
         ListGroupItem, Modal } from 'react-bootstrap';
import update = require('react-addons-update');
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import semver = require('semver');
import * as url from 'url';

import * as nodeUtil from 'util';

export interface IBaseProps {
  instanceId: string;
}

interface IConnectedProps {
  downloads: { [id: string]: any };
  downloadPath: string;
}

interface IMetaEditorState {
  display: boolean;
  info?: IModInfo;
  showRuleEditor: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class MetaEditorIcon extends ComponentEx<IProps, IMetaEditorState> {

  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: types.IComponentContext;

  constructor(props) {
    super(props);

    this.state = {
      display: false,
      info: undefined,
      showRuleEditor: false,
    };
  }

  public render(): JSX.Element {
    const { t, instanceId } = this.props;
    return (
      <tooltip.Button
        id='btn-meta-data'
        key={instanceId}
        tooltip={t('View Meta Data')}
        onClick={this.open}
      >
        <Icon name='edit' />
        {this.renderDialog()}
      </tooltip.Button>
    );
  }

  private renderDialog(): JSX.Element {
    const { t } = this.props;
    const { display, info, showRuleEditor } = this.state;

    if (info === undefined) {
      return null;
    }

    let fvState = semver.valid(info.fileVersion) === null ? 'error' : 'success';
    let urlState = url.parse(info.sourceURI).host === null ? 'error' : 'success';

    return (
      <Modal show={display} onHide={this.close}>
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
    let {t} = this.props;
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

  private removeRule = (evt) => {
    const idSegmented = evt.currentTarget.id.split('-');
    let idx = idSegmented[idSegmented.length - 1];
    this.setState(update(this.state, { info: {
      rules: { $splice: [[ idx, 1 ]] },
    }}));
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

  private setDialogVisible(visible: boolean, info?: IModInfo) {
    this.setState(update(this.state, {
      display: { $set: visible },
      info: { $set: info },
    }));
  }

  private getEmptyData(filePath?: string, fileInfo?: any) {
    let modName = filePath !== undefined
      ? path.basename(filePath, path.extname(filePath))
      : '';
    return {
      modId: '',
      modName,
      fileName: filePath,
      fileSizeBytes: fileInfo !== undefined ? fileInfo.size : 0,
      gameId: '',
      fileVersion: '',
      fileMD5: fileInfo !== undefined ? fileInfo.fileMD5 : '',
      sourceURI: '',
      rules: [],
      details: {},
    };
  }

  private initEmpty(filePath: string) {
    const { instanceId, downloads } = this.props;
    this.setDialogVisible(true, this.getEmptyData(filePath, downloads[instanceId]));
  }

  private open = () => {
    const { instanceId, downloadPath, downloads } = this.props;
    let filePath = path.join(downloadPath, downloads[instanceId].localPath);

    this.context.api.sendNotification({
      id: 'meta-lookup',
      type: 'activity',
      message: 'Mod lookup...',
    });

    this.context.api.lookupModMeta({
      filePath,
      fileMD5: downloads[instanceId].fileMD5,
      fileSize: downloads[instanceId].size,
     })
      .then((info: ILookupResult[]) => {
        if (info.length > 0) {
          this.setDialogVisible(true, info[0].value);
          return Promise.resolve();
        } else {
          return this.initEmpty(filePath);
        }
      })
      .catch((err) => {
        log('info', 'Failed to look up mod meta information', { err: nodeUtil.inspect(err) });
        this.initEmpty(filePath);
      })
      .finally(() => {
        this.context.api.dismissNotification('meta-lookup');
      })
      ;
  };

  private close = () => {
    this.setDialogVisible(false, this.getEmptyData());
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(MetaEditorIcon)
  ) as React.ComponentClass<IBaseProps>;
