import { setShowMetaEditor } from '../actions';

import { ComponentEx, FormFeedback, Icon,
         log, selectors, ToolbarIcon, tooltip,
         util } from 'vortex-api';

import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, ListGroup,
         ListGroupItem, Modal } from 'react-bootstrap';
import { connect } from 'react-redux';
import * as nodeUtil from 'util';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  instanceId: string;
  buttonType: string;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: any };
  downloadPath: string;
}

interface IActionProps {
  onShowDialog: (downloadId: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class MetaEditorIcon extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, instanceId } = this.props;
    return (
      <ToolbarIcon
        id='btn-meta-data'
        key={instanceId}
        icon='edit'
        text={t('View Meta Data')}
        onClick={this.open}
        buttonType={this.props.buttonType as any}
      />
    );
  }

  private open = () => {
    const { instanceId, downloadPath, downloads, onShowDialog } = this.props;

    onShowDialog(instanceId);
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onShowDialog: (downloadId: string) => dispatch(setShowMetaEditor(downloadId)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  MetaEditorIcon) as React.ComponentClass<IBaseProps>;
