import update from "immutability-helper";
import { IHashResult, ILookupResult, IReference, RuleType } from "modmeta-db";
import * as React from "react";
import {
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
  Modal,
  Nav,
  NavItem,
} from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { ComponentEx, FormFeedback } from "vortex-api";

interface IBaseProps {
  fileName: string;
  onHide: () => void;
  show: boolean;
  onConfirm: (type: RuleType, reference: IReference) => void;
}

interface IComponentState {
  md5: string;
  modId: string;
  logicalFileName: string;
  versionMatch: string;
  refType: string;
  ruleType: RuleType;
}

type IRule = IBaseProps;

const MD5Expression = /[a-f0-9]{32}/;

/**
 * editor for dependency rules
 *
 * @class RuleEditor
 * @extends {ComponentEx<IRule, IComponentState>}
 */
class RuleEditor extends ComponentEx<IRule, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      md5: "",
      modId: "",
      logicalFileName: "",
      versionMatch: "",
      refType: "meta",
      ruleType: "requires",
    };
  }

  public render(): JSX.Element {
    const { t, fileName, show } = this.props;
    const { refType, ruleType } = this.state;

    return (
      <Modal show={show} onHide={this.nop}>
        <Modal.Header>
          <Modal.Title>{fileName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <form>
            <FormGroup>
              <ControlLabel>{t("Rule Type")}</ControlLabel>
              <FormControl
                componentClass="select"
                value={ruleType}
                onChange={this.setRuleType}
              >
                <option value="before">{t("Always load before")}</option>
                <option value="after">{t("Always load after")}</option>
                <option value="requires">{t("Requires")}</option>
                <option value="conflicts">{t("Conflicts")}</option>
                <option value="recommends">{t("Recommends")}</option>
                <option value="provides">{t("Provides the same as")}</option>
              </FormControl>
            </FormGroup>
          </form>
          <Nav bsStyle="pills" activeKey={refType} onSelect={this.setRefType}>
            <NavItem eventKey="meta">Meta</NavItem>
            <NavItem eventKey="md5">MD5</NavItem>
          </Nav>
          {this.state.refType === "meta" ? this.renderMetaForm() : null}
          {this.state.refType === "md5" ? this.renderMD5Form() : null}
          <Button onClick={this.browseForArchive}>{t("Browse")}</Button>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.hide}>{t("Cancel")}</Button>
          <Button onClick={this.confirm}>{t("Save")}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private renderMetaForm = (): JSX.Element => {
    const { t } = this.props;
    const { modId, logicalFileName, versionMatch } = this.state;
    return (
      <form>
        <FormGroup>
          <ControlLabel>{t("Mod ID")}</ControlLabel>
          <FormControl type="text" value={modId} onChange={this.setModId} />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t("Logical File Name")}</ControlLabel>
          <FormControl
            type="text"
            value={logicalFileName}
            onChange={this.setFileName}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t("Version Match")}</ControlLabel>
          <FormControl
            type="text"
            value={versionMatch}
            onChange={this.setVersionMatch}
          />
        </FormGroup>
      </form>
    );
  };

  private renderMD5Form = (): JSX.Element => {
    const { t } = this.props;
    const { md5 } = this.state;

    const md5state =
      md5 === ""
        ? undefined
        : md5 === "..."
          ? "pending"
          : md5.match(MD5Expression)
            ? "success"
            : "error";

    return (
      <form>
        <FormGroup validationState={md5state as "error" | "success"}>
          <ControlLabel>{t("File Hash")}</ControlLabel>
          <FormControl type="text" value={md5} onChange={this.setMD5} />
          <FormFeedback />
        </FormGroup>
      </form>
    );
  };

  private nop = () => undefined;

  private setField(key: string, value: any): void {
    this.setState(
      update(this.state, {
        [key]: { $set: value },
      }),
    );
  }

  private setMD5 = (evt) => {
    this.setField("md5", evt.target.value);
  };

  private setModId = (evt) => {
    this.setField("modId", evt.target.value);
  };

  private setFileName = (evt) => {
    this.setField("logicalFileName", evt.target.value);
  };

  private setVersionMatch = (evt) => {
    this.setField("versionMatch", evt.target.value);
  };

  private setRefType = (e) => {
    this.setState(
      update(this.state, {
        refType: { $set: e },
      }),
    );
  };

  private setRuleType = (evt) => {
    this.setState(
      update(this.state, {
        ruleType: { $set: evt.target.value },
      }),
    );
  };

  private browseForArchive = () => {
    let filePath;
    this.context.api
      .selectFile({})
      .then((selectedFile: string) => {
        filePath = selectedFile;
        return this.context.api.lookupModMeta({ filePath }).catch(() => []);
      })
      .then((result: ILookupResult[]) => {
        // TODO: always use hash because lookup by meta information is not currently
        //   supported on the web side
        this.setState(update(this.state, { md5: { $set: "..." } }));
        const { genHash } = require("modmeta-db");
        return genHash(filePath).catch((err) => undefined);
        /*
        if (result.length === 0) {
          return genHash(filePath);
        } else {
          const modInfo = result[0].value;
          this.setState(update(this.state, {
            refType: { $set: 'meta' },
            modId: { $set: modInfo.modId },
            logicalFileName: { $set: modInfo.logicalFileName },
            versionMatch: { $set: modInfo.fileVersion },
          }));
        }
        */
      })
      .then((hash?: IHashResult) => {
        if (hash !== undefined) {
          this.setState(
            update(this.state, {
              refType: { $set: "md5" },
              md5: { $set: hash.md5sum },
            }),
          );
        }
      });
  };

  private clear() {
    this.setState(
      update(this.state, {
        md5: { $set: "" },
        modId: { $set: "" },
        logicalFileName: { $set: "" },
        versionMatch: { $set: "" },
      }),
    );
  }

  private hide = () => {
    this.clear();
    this.props.onHide();
  };

  private confirm = () => {
    const { onConfirm } = this.props;
    const { ruleType } = this.state;
    this.clear();
    if (this.state.refType === "meta") {
      onConfirm(ruleType, {
        logicalFileName: this.state.logicalFileName,
        versionMatch: this.state.versionMatch,
      });
    } else {
      onConfirm(ruleType, {
        fileMD5: this.state.md5,
      });
    }
  };
}

export default withTranslation(["common", "meta-editor"])(
  RuleEditor,
) as React.ComponentClass<IBaseProps>;
