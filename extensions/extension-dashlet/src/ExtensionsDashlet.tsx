import memoizeOne from "memoize-one";
import * as React from "react";
import { Button, ListGroup, ListGroupItem } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import {
  actions,
  ComponentEx,
  Dashlet,
  Icon,
  tooltip,
  types,
  util,
} from "vortex-api";

import { NAMESPACE, NUM_DISPLAY_ITEMS } from "./constants";

// 15 minutes
const ENDORSEMENT_DELAY = 15 * 60 * 1000;

interface IConnectedProps {
  extensionState: { [extId: string]: types.IExtensionState };
  extensions: types.IAvailableExtension[];
  installed: { [extId: string]: any };
  downloads: { [dlId: string]: types.IDownload };
  user: string;
}

interface IActionProps {
  onSetExtensionEndorsed: (extId: string, endorsed: string) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IExtensionsDashletState {
  skipEndorsing: boolean;
}

class ExtensionsDashlet extends ComponentEx<IProps, IExtensionsDashletState> {
  private extensionsByModId = memoizeOne((extensions) =>
    extensions.reduce((prev, ext) => {
      if (ext.modId !== undefined) {
        prev[ext.modId] = ext;
      }
      return prev;
    }, {}),
  );

  private downloadsByFileId = memoizeOne(
    (downloads: { [dlId: string]: types.IDownload }) => {
      const res: { [fileId: number]: string } = Object.keys(
        downloads ?? {},
      ).reduce((prev, dlId: string) => {
        const nexusFileId = util.getSafe(
          downloads[dlId],
          ["modInfo", "nexus", "ids", "fileId"],
          undefined,
        );
        if (nexusFileId !== undefined) {
          prev[nexusFileId] = dlId;
        }
        return prev;
      }, {});
      return res;
    },
  );

  constructor(props: IProps) {
    super(props);

    this.initState({ skipEndorsing: false });
  }

  public render(): JSX.Element {
    const { t, extensions, installed } = this.props;
    const { skipEndorsing } = this.state;

    const installedModIds = new Set(
      Object.values(installed).map((inst) => inst.modId),
    );

    const sortedAvailable = extensions
      .filter(
        (ext) => ext.timestamp !== undefined && !installedModIds.has(ext.modId),
      )
      .sort((lhs, rhs) => rhs.timestamp - lhs.timestamp)
      .slice(0, NUM_DISPLAY_ITEMS);

    const unendorsed = Object.keys(installed).filter((iter) =>
      this.isUnendorsed(iter),
    );

    const newsMode = skipEndorsing || unendorsed.length === 0;

    return (
      <Dashlet className="dashlet-extensions" title={t("Latest Extensions")}>
        {newsMode ? null : (
          <div className="extension-title">
            {t("Please endorse extensions you like")}
          </div>
        )}
        <ListGroup>
          {newsMode
            ? sortedAvailable.map((ext, idx) => this.renderExt(ext, idx))
            : unendorsed.map((extId, idx) => this.renderEndorse(extId, idx))}
        </ListGroup>
        {newsMode ? null : (
          <Button onClick={this.notNow}>{t("Not now")}</Button>
        )}
      </Dashlet>
    );
  }

  private renderExt = (ext: any, idx: number) => {
    const { t } = this.props;

    const onClick = () => {
      this.context.api.events.emit(
        "analytics-track-click-event",
        "Dashboard",
        "View latest extension",
      );
    };

    return (
      <ListGroupItem className="extension-item" key={idx}>
        <div className="extension-type">{ext.type || "extension"}</div>
        <div
          className="extension-image"
          style={{ background: `url(${ext.image})` }}
        />
        <h4>
          <a onClick={onClick} href={this.nexusUrl(ext)}>
            {ext.name}
          </a>
        </h4>
        <p className="extension-summary">{ext.description.short}</p>
        <div className="extension-extra">
          <div>
            <Icon name="author" />{" "}
            {t("By {{author}}", { replace: { author: ext.author } })}
          </div>
          <Button data-modid={ext.modId} onClick={this.installExt}>
            {t("Install")}
          </Button>
        </div>
      </ListGroupItem>
    );
  };

  private renderEndorse = (extId: string, idx: number) => {
    const { t, extensions, installed } = this.props;

    const inst = installed[extId];
    const ext = extensions.find((iter) => iter.modId === inst.modId);
    if (ext === undefined) {
      return null;
    }

    return (
      <ListGroupItem className="endorse-item" key={idx}>
        <div className="extension-type">{ext.type || "extension"}</div>
        <div
          className="extension-image"
          style={{ background: `url(${ext.image})` }}
        />
        <div className="extension-name">
          {ext.name}
          <div>
            <tooltip.IconButton
              tooltip={t("Endorse")}
              icon="endorse-yes"
              data-extid={extId}
              onClick={this.endorse}
            />
            <tooltip.IconButton
              tooltip={t("Abstain")}
              icon="endorse-no"
              data-extid={extId}
              onClick={this.abstain}
            />
          </div>
        </div>
      </ListGroupItem>
    );
  };

  private isUnendorsed(extId: any) {
    const { downloads, extensions, extensionState, installed, user } =
      this.props;

    if (installed[extId].modId === undefined) {
      return false;
    }

    const ext = util.getSafe(
      this.extensionsByModId(extensions),
      [installed[extId].modId],
      undefined,
    );

    if (ext === undefined) {
      return false;
    }

    const dlId =
      ext !== undefined
        ? this.downloadsByFileId(downloads)[ext.fileId]
        : undefined;

    const now = Date.now();

    return (
      ext.uploader !== user &&
      (dlId === undefined ||
        now - downloads[dlId].fileTime > ENDORSEMENT_DELAY) &&
      util.getSafe(extensionState, [extId, "endorsed"], "Undecided") ===
        "Undecided"
    );
  }

  private nexusUrl = (ext: any) => {
    return `https://www.nexusmods.com/site/mods/${ext.modId}`;
  };

  private notNow = () => {
    this.nextState.skipEndorsing = true;
  };

  private installExt = (evt: React.MouseEvent<any>) => {
    const modId = parseInt(evt.currentTarget.dataset.modid, 10);
    const ext = this.props.extensions.find((iter) => iter.modId === modId);
    if (ext !== undefined) {
      this.context.api.emitAndAwait("install-extension", ext).then(() => {
        this.context.api.sendNotification({
          type: "success",
          message: "Extension installed, please restart Vortex to enable it",
          displayMS: 2000,
        });
      });
    }
  };

  private endorse = (evt: React.MouseEvent<any>) => {
    const extId = evt.currentTarget.getAttribute("data-extid");
    this.sendEndorse(extId, "endorse");
  };

  private abstain = (evt: React.MouseEvent<any>) => {
    const extId = evt.currentTarget.getAttribute("data-extid");
    this.sendEndorse(extId, "abstain");
  };

  private sendEndorse(extId: string, targetState: string) {
    const { installed, onSetExtensionEndorsed } = this.props;
    this.context.api
      .emitAndAwait(
        "endorse-nexus-mod",
        "site",
        installed[extId].modId,
        installed[extId].version,
        targetState,
      )
      .then((endorsed: string[]) => {
        onSetExtensionEndorsed(extId, endorsed[0]);
      })
      .catch(() => {
        onSetExtensionEndorsed(extId, "Undecided");
      });
  }
}

function mapStateToProps(state: types.IState): IConnectedProps {
  return {
    extensionState: state.app.extensions,
    extensions: state.session.extensions.available,
    installed: state.session.extensions.installed,
    downloads: state.persistent.downloads.files,
    user: util.getSafe(
      state,
      ["persistent", "nexus", "userInfo", "name"],
      undefined,
    ),
  };
}

type DispatchT = ThunkDispatch<types.IState, null, Redux.Action>;

function mapDispatchToProps(dispatch: DispatchT): IActionProps {
  return {
    onSetExtensionEndorsed: (extId: string, endorsed: string) =>
      dispatch((actions as any).setExtensionEndorsed(extId, endorsed)),
  };
}

export default withTranslation([NAMESPACE, "common"])(
  connect(mapStateToProps, mapDispatchToProps)(ExtensionsDashlet) as any,
);
