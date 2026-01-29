import { setShowMetaEditor } from "../actions";

import { ComponentEx, selectors, ToolbarIcon, types } from "vortex-api";

import * as React from "react";
import { connect } from "react-redux";

export interface IBaseProps {
  t: types.TFunction;
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
        key={instanceId}
        icon="edit"
        text={t("View Meta Data")}
        onClick={this.open}
      />
    );
  }

  private open = () => {
    const { instanceId, downloadPath, downloads, onShowDialog } = this.props;

    onShowDialog(instanceId);
  };
}

function mapStateToProps(state): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onShowDialog: (downloadId: string) =>
      dispatch(setShowMetaEditor(downloadId)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(MetaEditorIcon) as any as React.ComponentClass<IBaseProps>;
