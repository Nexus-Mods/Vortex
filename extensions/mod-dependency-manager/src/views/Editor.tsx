import { closeDialog, setType } from "../actions";
import { NAMESPACE } from "../statics";

import minimatch from "minimatch";
import { IReference, IRule, RuleType } from "modmeta-db";
import * as React from "react";
import {
  Button,
  Col,
  ControlLabel,
  Form,
  FormControl,
  FormGroup,
  Modal,
} from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import * as semver from "semver";
import {
  actions,
  ComponentEx,
  FormFeedback,
  More,
  types,
  util,
} from "vortex-api";

interface IDialog {
  gameId: string;
  modId: string;
  reference: IReference;
  type: RuleType;
}

interface IConnectedProps {
  dialog: IDialog;
  mod: types.IMod;
}

interface IActionProps {
  onCloseDialog: () => void;
  onSetType: (type: RuleType) => void;
  onAddRule: (gameId: string, modId: string, rule: IRule) => void;
}

interface IComponentState {
  type: RuleType;
  reference: IReference;
}

type IProps = IConnectedProps & IActionProps;

function nop() {
  // nop
}

/**
 * simple dialog to set dependency rules between two mods
 *
 * @class Editor
 * @extends {ComponentEx<IProps, IComponentState>}
 */
class Editor extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({ type: undefined, reference: undefined });
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.dialog !== nextProps.dialog) {
      if (
        nextProps.dialog !== undefined &&
        nextProps.dialog.reference !== undefined
      ) {
        this.nextState.type = nextProps.dialog.type;
        this.nextState.reference = {
          ...nextProps.dialog.reference,
          versionMatch: this.genVersionMatch(
            nextProps.dialog.reference.versionMatch,
          ),
        };
      } else {
        this.nextState.type = undefined;
        this.nextState.reference = undefined;
      }
    }
  }

  public render(): JSX.Element {
    const { t, dialog, mod } = this.props;
    const { reference, type } = this.state;

    return (
      <Modal show={dialog !== undefined} onHide={nop}>
        {dialog !== undefined ? (
          <Modal.Body>
            {this.renderSource(mod)}
            <FormControl
              componentClass="select"
              onChange={this.changeType}
              value={type}
              style={{ marginTop: 20, marginBottom: 20 }}
            >
              <option value="before">{t("Must deploy before")}</option>
              <option value="after">{t("Must deploy after")}</option>
              <option value="requires">{t("Requires")}</option>
              <option value="conflicts">
                {t("Conflicts with / Can't be deployed together with")}
              </option>
            </FormControl>
            {this.renderReference(reference)}
          </Modal.Body>
        ) : null}
        <Modal.Footer>
          <Button onClick={this.close}>{t("Cancel")}</Button>
          <Button onClick={this.save}>{t("Save")}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderSource = (mod: types.IMod) => {
    return <p>{util.renderModName(mod)}</p>;
  };

  private renderReference = (reference: IReference): JSX.Element => {
    const { t, dialog } = this.props;
    const { logicalFileName, versionMatch, fileExpression, fileMD5 } =
      reference;

    if (
      (logicalFileName === "" && fileExpression === "") ||
      versionMatch === undefined
    ) {
      return (
        <Form horizontal>
          <FormGroup>
            <Col sm={3} componentClass={ControlLabel}>
              {t("MD5")}
            </Col>
            <Col sm={9}>
              <FormControl type="text" value={fileMD5} readOnly={true} />
            </Col>
          </FormGroup>
        </Form>
      );
    }

    let expressionInvalid = null;
    if (logicalFileName === undefined) {
      expressionInvalid = minimatch(
        dialog.reference.fileExpression,
        fileExpression,
      )
        ? null
        : t("Doesn't match the file name");
    }

    const nameLabel =
      logicalFileName !== undefined ? (
        <Col sm={3} componentClass={ControlLabel}>
          {t("Name")}
        </Col>
      ) : (
        <Col sm={3} componentClass={ControlLabel}>
          {t("Name matching")}
          <More id="more-namematch-editor" name={t("Name matching")}>
            {util.getText("mod", "namematch", t)}
          </More>
        </Col>
      );

    const refVer = dialog.reference.versionMatch;

    let versionInvalid = null;

    if (versionMatch === "*") {
      // treat * as always valid, even if the version is not semver compliant
    } else if (semver.validRange(versionMatch) === null) {
      versionInvalid = t("Range invalid");
    } else if (
      semver.valid(refVer) &&
      !semver.satisfies(refVer, versionMatch)
    ) {
      versionInvalid = t("Doesn't match the mod");
    } else if (!semver.valid(refVer) && refVer !== versionMatch) {
      versionInvalid = t("Doesn't match the mod");
    }

    return (
      <Form horizontal>
        <FormGroup>
          {nameLabel}
          <Col sm={9}>
            <FormGroup
              style={{ marginLeft: 0, marginRight: 0 }}
              validationState={expressionInvalid !== null ? "error" : "success"}
            >
              <FormControl
                type="text"
                value={logicalFileName || fileExpression}
                readOnly={logicalFileName !== undefined}
                onChange={this.changeFileExpression}
              />
              <ControlLabel>{expressionInvalid}</ControlLabel>
              <FormFeedback />
            </FormGroup>
          </Col>
        </FormGroup>
        <FormGroup>
          <Col sm={3} componentClass={ControlLabel}>
            {t("Version Match")}
            <More id="more-versionmatch-editor" name={t("Version matching")}>
              {util.getText("mod", "versionmatch", t)}
            </More>
          </Col>
          <Col sm={9}>
            <FormGroup
              style={{ marginLeft: 0, marginRight: 0 }}
              validationState={versionInvalid !== null ? "error" : "success"}
            >
              <FormControl
                type="text"
                value={versionMatch}
                onChange={this.changeVersion}
              />
              <ControlLabel>{versionInvalid}</ControlLabel>
              <FormFeedback />
            </FormGroup>
          </Col>
        </FormGroup>
      </Form>
    );
  };

  private genVersionMatch(input: string): string {
    if (input === undefined || !semver.valid(input)) {
      return "*";
    } else {
      return "^" + input;
    }
  }

  private changeFileExpression = (evt) => {
    this.nextState.reference.fileExpression = evt.currentTarget.value;
  };

  private changeVersion = (evt) => {
    this.nextState.reference.versionMatch = evt.currentTarget.value;
  };

  private changeType = (evt) => {
    this.nextState.type = evt.currentTarget.value;
  };

  private save = () => {
    const { dialog, onAddRule } = this.props;
    const { reference, type } = this.state;

    if (reference === undefined) {
      return;
    }

    let addRef;
    if (reference.versionMatch !== undefined) {
      if (reference.logicalFileName !== undefined) {
        addRef = {
          logicalFileName: reference.logicalFileName,
          versionMatch: reference.versionMatch,
        };
      } else {
        addRef = {
          fileExpression: reference.fileExpression,
          versionMatch: reference.versionMatch,
        };
      }
    } else {
      addRef = { fileMD5: reference.fileMD5 };
    }

    onAddRule(dialog.gameId, dialog.modId, {
      reference: addRef,
      type,
    });

    this.close();
  };

  private close = () => {
    this.props.onCloseDialog();
  };
}

function mapStateToProps(state: any): IConnectedProps {
  const dialog: IDialog = state.session.dependencies.dialog || undefined;
  const mod =
    dialog !== undefined
      ? util.getSafe(
          state,
          ["persistent", "mods", dialog.gameId, dialog.modId],
          undefined,
        )
      : undefined;
  return {
    dialog,
    mod,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onCloseDialog: () => dispatch(closeDialog()),
    onSetType: (type) => dispatch(setType(type)),
    onAddRule: (gameId, modId, rule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(Editor) as any,
) as React.ComponentClass<{}>;
