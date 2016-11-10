import { ComponentEx, FormFeedbackAwesome, Icon,
         connect, log, tooltip, translate, types } from 'nmm-api';

import { IHashResult, ILookupResult, IModInfo, genHash } from 'modmeta-db';
import * as path from 'path';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Modal } from 'react-bootstrap';
import update = require('react-addons-update');
import semver = require('semver');
import * as url from 'url';

export interface IBaseProps {
  downloadId: string;
}

interface IConnectedProps {
  downloads: { [id: string]: any };
}

interface IMetaEditorState {
  display: boolean;
  info?: IModInfo;
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
    };
  }

  public render(): JSX.Element {
    const { t, downloadId } = this.props;
    return (
      <tooltip.Button
        id='btn-meta-data'
        key={downloadId}
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
    const { display, info } = this.state;

    if (!display) {
      return null;
    }

    let fvState = semver.valid(info.fileVersion) === null ? 'error' : 'success';
    let urlState = url.parse(info.sourceURI).host === null ? 'error' : 'success';

    return (
      <Modal show={true} onHide={this.close}>
        <Modal.Header>Meta Data</Modal.Header>
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
              <ControlLabel>{t('File Version')}</ControlLabel>
            </FormGroup>
            <FormGroup
              validationState={fvState as 'error' | 'success'}
            >
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
              <FormControl
                type='text'
                value={info.sourceURI}
                onChange={this.changeSourceURI}
              />
              <FormFeedbackAwesome />
            </FormGroup>
          </form>
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

  private open = () => {
    const { downloadId, downloads } = this.props;
    let filePath = downloads[downloadId].localPath;
    this.context.api.lookupModMeta(filePath, {})
      .then((info: ILookupResult[]) => {
        if (info.length > 0) {
          this.setDialogVisible(true, info[0].value);
        } else {
          genHash(filePath)
            .then((hashResult: IHashResult) => {
              this.setDialogVisible(true, {
                modId: '',
                modName: path.basename(filePath, path.extname(filePath)),
                fileName: filePath,
                fileSizeBytes: hashResult.numBytes,
                gameId: '',
                fileVersion: '',
                fileMD5: hashResult.md5sum,
                sourceURI: '',
                rules: [],
                details: {},
              });
          });
        }
      })
      .catch((err) => {
        log('error', 'Failed to look up mod meta information', { err: err.message });
      });
  };

  private close = () => {
    this.setDialogVisible(false);
  }
}

function mapStateToProps(state) {
  return {
    downloads: state.persistent.downloads.files,
  }
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps)(MetaEditorIcon)
  );
