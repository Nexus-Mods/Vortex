import { setShowMetaEditor } from "../actions";

import RuleEditor from "./RuleEditor";

import update from "immutability-helper";
import type { IModInfo, IReference, IRule, RuleType } from "modmeta-db";
import * as React from "react";
import {
  ControlLabel,
  FormControl,
  FormGroup,
  ListGroup,
  ListGroupItem,
  Modal,
} from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import {
  ComponentEx,
  FormFeedback,
  Icon,
  selectors,
  tooltip,
  types,
  util,
} from "vortex-api";

interface IBaseProps {
  retrieveInfo: (downloadId: string) => Promise<IModInfo>;
  validateVersion: (version: string) => "error" | "success";
  validateURI: (uri: string) => "error" | "success";
}

interface IConnectedProps {
  downloads: { [id: string]: types.IDownload };
  visibleId: string;
  downloadPath: string;
}

interface IActionProps {
  onHide: () => void;
  onShowError: (
    title: string,
    details: any,
    options?: types.IErrorOptions,
  ) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

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

  public componentDidUpdate(prevProps: IProps): void {
    if (this.props.visibleId !== prevProps.visibleId) {
      this.triggerInfoUpdate(this.props.visibleId);
    }
  }

  private async triggerInfoUpdate(visibleId: string) {
    try {
      this.nextState.info = await this.props.retrieveInfo(visibleId);
    } catch (err) {
      this.props.onShowError("failed to fetch mod info", err);
    }
  }

  public render(): JSX.Element {
    const { t, validateURI, validateVersion } = this.props;
    const { info, showRuleEditor } = this.state;

    if (info === undefined) {
      return null;
    }

    const fvState = validateVersion(info.fileVersion);
    const urlState = validateURI(info.sourceURI);

    return (
      <Modal show={info !== undefined} onHide={this.close}>
        <Modal.Header>
          <Modal.Title>{info.logicalFileName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form>
            <FormGroup>
              <ControlLabel>{t("File Name")}</ControlLabel>
              <FormControl
                type="text"
                value={info.logicalFileName}
                onChange={this.changeLogicalFileName}
              />
            </FormGroup>
            <FormGroup validationState={fvState as "error" | "success"}>
              <ControlLabel>{t("File Version")}</ControlLabel>
              <FormControl
                type="text"
                value={info.fileVersion}
                onChange={this.changeFileVersion}
              />
              <FormFeedback />
            </FormGroup>
            <FormGroup validationState={urlState as "error" | "success"}>
              <ControlLabel>{t("Source URL")}</ControlLabel>
              <FormControl
                type="text"
                value={info.sourceURI}
                onChange={this.changeSourceURI}
              />
              <FormFeedback />
            </FormGroup>
            <FormGroup>
              <ControlLabel>
                {t("Rules")}{" "}
                <tooltip.Button
                  className="btn-embed"
                  tooltip={t("Add")}
                  id="add-rule"
                  onClick={this.showRuleEditor}
                >
                  <Icon name="add" />
                </tooltip.Button>
              </ControlLabel>
              <ListGroup>
                {info.rules !== undefined
                  ? info.rules.map(this.renderRule)
                  : null}
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
            id="cancel-meta-btn"
            tooltip={t("Cancel")}
            onClick={this.cancel}
          >
            {t("Cancel")}
          </tooltip.Button>
          <tooltip.Button
            id="save-meta-btn"
            tooltip={t("Save in local DB")}
            onClick={this.save}
          >
            {t("Save")}
          </tooltip.Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderRule = (rule: IRule, index: number) => {
    const { t } = this.props;
    return (
      <ListGroupItem key={`rule-${index}`}>
        {rule.type} - {this.renderReference(rule.reference)}
        <div className="rule-actions pull-right">
          <tooltip.Button
            id={`rule-${index}`}
            tooltip={t("Remove")}
            onClick={this.removeRule}
          >
            <Icon name="remove" />
          </tooltip.Button>
        </div>
      </ListGroupItem>
    );
  };

  private renderReference = (reference: IReference) => {
    if (reference.fileMD5 !== undefined) {
      return reference.fileMD5;
    } else {
      return `${reference.logicalFileName} - ${reference.versionMatch}`;
    }
  };

  private removeRule = (evt) => {
    const idSegmented = evt.currentTarget.id.split("-");
    const idx = idSegmented[idSegmented.length - 1];
    this.setState(
      update(this.state, {
        info: {
          rules: { $splice: [[idx, 1]] },
        },
      }),
    );
  };

  private addRule = (type: RuleType, reference: IReference) => {
    const rule = { type, reference };
    this.setState(util.pushSafe(this.state, ["info", "rules"], rule), () => {
      this.hideRuleEditor();
    });
  };

  private save = () => {
    this.context.api.saveModMeta(this.state.info);
    this.close();
  };

  private cancel = () => {
    this.close();
  };

  private showRuleEditor = () => {
    this.setState(
      update(this.state, {
        showRuleEditor: { $set: true },
      }),
    );
  };

  private hideRuleEditor = () => {
    this.setState(
      update(this.state, {
        showRuleEditor: { $set: false },
      }),
    );
  };

  private setField(key: string, value: any) {
    this.setState(
      update(this.state, {
        info: {
          [key]: { $set: value },
        },
      }),
    );
  }

  private changeLogicalFileName = (event) => {
    this.setField("logicalFileName", event.target.value);
  };

  private changeFileVersion = (event) => {
    this.setField("fileVersion", event.target.value);
  };

  private changeSourceURI = (event) => {
    this.setField("sourceURI", event.target.value);
  };

  private close = () => {
    this.props.onHide();
  };
}

function mapStateToProps(state: types.IState): IConnectedProps {
  return {
    downloads: state.persistent.downloads.files,
    visibleId: (state.session as any).metaEditor.showDialog,
    downloadPath: selectors.downloadPath(state),
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onHide: () => dispatch(setShowMetaEditor(undefined)),
    onShowError: (title: string, details: any, options: types.IErrorOptions) =>
      util.showError(dispatch, title, details, options),
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(MetaEditorDialog) as any,
) as React.ComponentClass<{}>;
