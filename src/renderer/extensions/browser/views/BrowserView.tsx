import { addNotification } from "../../../actions";
import Modal from "../../../controls/Modal";
import Spinner from "../../../controls/Spinner";
import { IconButton } from "../../../controls/TooltipControls";
import { WebviewEmbed, WebviewOverlay } from "../../../controls/Webview";
import type { INotification } from "../../../types/INotification";
import type { IState } from "../../../types/IState";
import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import Debouncer from "../../../util/Debouncer";
import { log } from "../../../util/log";
import { truthy } from "../../../util/util";
import { Notification } from "../../../views/Notification";
import { closeBrowser } from "../actions";

import PromiseBB from "bluebird";
import { clipboard } from "electron";
import * as _ from "lodash";
import * as React from "react";
import { Breadcrumb, Button } from "react-bootstrap";
import * as ReactDOM from "react-dom";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";
import * as nodeUrl from "url";
import { getErrorMessageOrDefault } from "@vortex/shared";

export type SubscriptionResult = "close" | "continue" | "ignore";

export interface IBaseProps {
  onHide: () => void;
  onNavigate: (url: string) => void;
  onEvent: (
    subscriber: string,
    eventId: string,
    value: any,
  ) => SubscriptionResult;
  overlay: boolean;
}

interface IConnectedProps {
  url: string;
  subscriber: string;
  instructions: string;
  skippable: boolean;
  notifications: INotification[];
}

interface IActionProps {
  onClose: () => void;
  onNotification: (notification: INotification) => void;
}

interface IComponentState {
  confirmed: boolean;
  loading: boolean;
  url: string;
  opened: number;
  history: string[];
  historyIdx: number;
  filtered: INotification[];
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

function nop() {
  return null;
}

class BrowserView extends ComponentEx<IProps, IComponentState> {
  private mRef: WebviewOverlay | WebviewEmbed;
  private mWebView = null;
  private mCallbacks: { [event: string]: (...args: any[]) => void };
  private mSessionCallbacks: { [event: string]: (...args: any[]) => void };
  private mLoadingDebouncer: Debouncer;
  private mUpdateTimer: NodeJS.Timeout = undefined;
  private mMounted: boolean = false;
  private mCurrentUrl: string;

  constructor(props: IProps) {
    super(props);
    this.initState({
      confirmed: false,
      loading: false,
      url: props.url,
      history: [props.url],
      historyIdx: 0,
      opened: 0,
      filtered: [],
    });

    this.mCurrentUrl = props.url;

    this.mLoadingDebouncer = new Debouncer(
      (loading: boolean) => {
        if (loading !== this.state.loading) {
          this.nextState.loading = loading;
        }
        return PromiseBB.resolve();
      },
      100,
      false,
    );

    this.mCallbacks = {
      "did-finish-load": () => {
        const newUrl: string = this.mCurrentUrl;
        this.nextState.url = newUrl;
        this.props.onEvent(this.props.subscriber, "navigate", newUrl);
        if (newUrl !== this.nextState.history[this.nextState.historyIdx]) {
          this.nextState.history.splice(
            this.nextState.historyIdx + 1,
            9999,
            newUrl,
          );
          ++this.nextState.historyIdx;
        }
      },
      "did-navigate": (evt) => {
        this.mCurrentUrl = typeof evt === "string" ? evt : evt.url;

        this.navigate(this.mCurrentUrl);
      },
      "did-navigate-in-page": (evt) => {
        this.mCurrentUrl = typeof evt === "string" ? evt : evt.url;
        this.navigate(this.mCurrentUrl);
      },
    };
  }

  public componentDidMount() {
    this.updateFiltered();
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
    if (this.mUpdateTimer !== undefined) {
      clearTimeout(this.mUpdateTimer);
    }
  }

  public componentDidUpdate(prevProps: IProps) {
    if (prevProps.notifications !== this.props.notifications) {
      this.updateFiltered();
    }
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (newProps.url !== this.props.url) {
      if (
        newProps.url === undefined ||
        this.props.url === undefined ||
        new URL(newProps.url).hostname !== new URL(this.props.url).hostname
      ) {
        this.nextState.confirmed = false;
        this.nextState.opened = Date.now();
        if (newProps.url !== undefined) {
          this.nextState.history = [newProps.url];
          this.nextState.historyIdx = 0;
        }
      }
      this.nextState.url = this.mCurrentUrl = newProps.url;
    }
  }

  public shouldComponentUpdate(newProps: IProps, newState: IComponentState) {
    const res =
      this.props.url !== newProps.url ||
      this.props.instructions !== newProps.instructions ||
      this.props.notifications !== newProps.notifications ||
      this.state.url !== newState.url ||
      this.state.loading !== newState.loading ||
      this.state.confirmed !== newState.confirmed ||
      this.state.history !== newState.history ||
      this.state.historyIdx !== newState.historyIdx ||
      this.state.filtered !== newState.filtered;
    return res;
  }

  public render(): JSX.Element {
    const { t, overlay, instructions, skippable } = this.props;
    const { confirmed, filtered, history, historyIdx, loading, url } =
      this.state;
    const referrer = history.length > 0 ? history[historyIdx - 1] : undefined;

    const Webview = overlay ? WebviewOverlay : WebviewEmbed;

    return (
      <Modal id="browser-dialog" show={url !== undefined} onHide={nop}>
        <Modal.Header>
          {this.renderNav()}
          {this.renderUrl(history[historyIdx])}
          {loading ? <Spinner /> : null}
          <IconButton
            icon="clipboard"
            tooltip={t("Copy URL to clipboard")}
            onClick={this.copyUrlToClipboard}
          />
        </Modal.Header>
        <Modal.Body>
          {instructions !== undefined ? (
            <p id="browser-instructions">{instructions}</p>
          ) : null}
          {confirmed ? (
            <Webview
              id="browser-webview"
              src={url}
              ref={this.setRef as any}
              httpreferrer={referrer}
              onLoading={this.loading}
              onNewWindow={this.newWindow}
              events={this.mCallbacks}
            />
          ) : (
            this.renderConfirm()
          )}
          <div className="browser-notifications">
            {filtered.map(this.renderNotification)}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>{t("Cancel")}</Button>
          {skippable ? <Button onClick={this.skip}>{t("Skip")}</Button> : null}
        </Modal.Footer>
      </Modal>
    );
  }

  private renderNotification = (
    notification: INotification,
    idx: number,
  ): JSX.Element => {
    const { t } = this.props;

    const translated: INotification = { ...notification };
    translated.title =
      translated.title !== undefined &&
      (notification.localize === undefined ||
        notification.localize.title !== false)
        ? t(translated.title, { replace: translated.replace })
        : translated.title;

    translated.message =
      notification.localize === undefined ||
      notification.localize.message !== false
        ? t(translated.message, { replace: translated.replace })
        : translated.message;

    return <Notification key={idx} collapsed={1} params={translated} />;
  };

  private renderLoadingOverlay(): JSX.Element {
    return (
      <div className="browser-loading">
        <Spinner />
      </div>
    );
  }

  private renderNav(): JSX.Element {
    const { t } = this.props;
    const { history, historyIdx } = this.state;
    return (
      <div>
        <IconButton
          icon="nav-back"
          onClick={this.navBack}
          disabled={historyIdx === 0}
          tooltip={t("Back")}
        />
        <IconButton
          icon="nav-forward"
          onClick={this.navForward}
          disabled={historyIdx === history.length - 1}
          tooltip={t("Forward")}
        />
      </div>
    );
  }

  private renderUrl(input: string): JSX.Element {
    if (!truthy(input)) {
      return null;
    }
    const parsed = nodeUrl.parse(input);
    const segments = (parsed.pathname ?? "")
      .split("/")
      .filter((seg) => seg.length > 0);
    const Item: any = Breadcrumb.Item;
    return (
      <Breadcrumb>
        <Item data-idx={-1} onClick={this.navCrumb}>
          {parsed.protocol}//{parsed.hostname}
        </Item>
        {segments.map((seg, idx) => (
          <Item
            data-idx={idx}
            key={`${idx}-${seg}`}
            onClick={this.navCrumb}
            active={idx === segments.length - 1}
          >
            {seg}
          </Item>
        ))}
        <Item active>{parsed.search}</Item>
      </Breadcrumb>
    );
  }

  private copyUrlToClipboard = () => {
    clipboard.writeText(this.props.url ?? "");
  };

  private renderConfirm() {
    const { t, url } = this.props;
    return (
      <div>
        <h3>{t("Attention")}</h3>
        <p>{t("Vortex is about to open an external web page:")}</p>
        <a href="#">{url}</a>
        <p>
          {t(
            "Please be aware that Vortex is based on Electron which in turn is based on " +
              "Chrome, but it will not always be the newest version. Also, we can't rule out " +
              "that electron might contain it's own security issues pertaining to website " +
              "access.",
          )}
        </p>
        <p>
          {t(
            "If you have security concerns or don't fully trust this page, please don't " +
              "continue. Don't navigate away from pages you don't trust.",
          )}
        </p>
        <Button onClick={this.confirm}>{t("Continue")}</Button>
      </div>
    );
  }

  private displayTime = (item: INotification) => {
    if (item.displayMS !== undefined) {
      return item.displayMS;
    }

    return (
      {
        warning: 10000,
        error: 10000,
        success: 5000,
        info: 5000,
        activity: null,
      }[item.type] || 5000
    );
  };

  private updateFiltered() {
    const { notifications } = this.props;
    const { opened } = this.state;

    this.mUpdateTimer = undefined;

    if (!this.mMounted) {
      return;
    }

    const now = Date.now();

    const filtered = notifications.filter((item) => {
      if (
        ["activity", "silent"].includes(item.type) ||
        item.createdTime < opened
      ) {
        return false;
      }
      const displayTime = this.displayTime(item);
      return displayTime === null || item.createdTime + displayTime > now;
    });

    if (!_.isEqual(this.state.filtered, filtered)) {
      this.nextState.filtered = filtered;
    }

    if (filtered.length > 0) {
      if (this.mUpdateTimer !== undefined) {
        // should never happen
        clearTimeout(this.mUpdateTimer);
      }
      this.mUpdateTimer = setTimeout(() => this.updateFiltered(), 1000);
    }
  }

  private loading = (loading: boolean) => {
    if (loading) {
      this.mLoadingDebouncer.schedule(undefined, true);
    } else {
      this.mLoadingDebouncer.runNow(undefined, false);
    }
  };

  private newWindow = (newUrl: string, disposition: string) => {
    const { onEvent, subscriber } = this.props;

    const urlParsed = nodeUrl.parse(newUrl);
    if (urlParsed.hostname === "drive.google.com") {
      this.nextState.url = newUrl;
      return;
    }

    // currently we try to download any url that isn't opened in the same window
    const res = onEvent(subscriber, "download-url", newUrl);
    if (res === "close") {
      this.props.onClose();
    } else if (res === "continue") {
      // no handler for download-url? Then lets try to open the link
      this.nextState.url = newUrl;
    }
  };

  private setRef = (ref: WebviewOverlay | WebviewEmbed) => {
    this.mRef = ref;
    if (ref !== null) {
      this.mWebView = ReactDOM.findDOMNode(this.mRef) as any;
      if (truthy(this.mWebView)) {
        Object.keys(this.mCallbacks).forEach((event) => {
          this.mWebView.addEventListener(event, this.mCallbacks[event]);
        });
      }
    } else {
      if (truthy(this.mWebView)) {
        Object.keys(this.mCallbacks).forEach((event) => {
          this.mWebView.removeEventListener(event, this.mCallbacks[event]);
        });
      }
    }
  };

  private navBack = () => {
    const { history, historyIdx } = this.state;
    const newPos = Math.max(0, historyIdx - 1);
    this.nextState.historyIdx = newPos;
    // this.nextState.url = history[newPos];
    if (truthy(this.mWebView)) {
      try {
        this.mRef.loadURL(history[newPos]);
      } catch (err) {
        log("warn", "failed to navigate", {
          url: history[newPos],
          error: getErrorMessageOrDefault(err),
        });
      }
    }
  };

  private navForward = () => {
    const { history, historyIdx } = this.state;
    const newPos = Math.min(history.length - 1, historyIdx + 1);
    this.nextState.historyIdx = newPos;
    // this.nextState.url = history[newPos];
    if (truthy(this.mWebView)) {
      try {
        this.mRef.loadURL(history[newPos]);
      } catch (err) {
        log("warn", "failed to navigate", {
          url: history[newPos],
          error: getErrorMessageOrDefault(err),
        });
      }
    }
  };

  private navCrumb = (evt) => {
    if (!truthy(this.mWebView) || !truthy(this.mCurrentUrl)) {
      return;
    }

    const idx = parseInt(evt.currentTarget.getAttribute("data-idx"), 10);
    // const parsed = nodeUrl.parse(this.mWebView.getURL());
    const parsed = nodeUrl.parse(this.mCurrentUrl);
    parsed.pathname = (parsed.pathname ?? "")
      .split("/")
      .slice(0, idx + 2)
      .join("/");
    parsed.path = undefined;
    parsed.href = undefined;
    parsed.search = undefined;

    const nextUrl = nodeUrl.format(parsed);
    this.addToHistory(nextUrl);
    try {
      this.mRef.loadURL(nextUrl);
    } catch (err) {
      log("warn", "failed to navigate", {
        url: nextUrl,
        error: getErrorMessageOrDefault(err),
      });
    }
  };

  private confirm = () => {
    this.nextState.confirmed = true;
  };

  private sanitised(input: string): string {
    const parsed = nodeUrl.parse(input);
    parsed.hash = null;
    parsed.search = null;
    parsed.query = null;
    return nodeUrl.format(parsed);
  }

  private addToHistory(url: string) {
    url = url.replace(/[\/]*$/, "");
    if (url !== this.nextState.history[this.nextState.historyIdx]) {
      this.nextState.history.splice(this.nextState.historyIdx + 1, 9999, url);
      ++this.nextState.historyIdx;
    }
  }

  private navigate(url: string) {
    if (this.sanitised(url) === this.sanitised(this.state.url)) {
      // don't do anything if just the hash changed
      return;
    }

    // this.nextState.url = url;
    this.addToHistory(url);
    this.props.onNavigate(url);
  }

  private skip = () => {
    const { onClose, onEvent, subscriber } = this.props;
    if (onEvent(subscriber, "close", true) !== "ignore") {
      onClose();
    }
  };

  private close = () => {
    const { onClose, onEvent, subscriber } = this.props;
    if (onEvent(subscriber, "close", false) !== "ignore") {
      onClose();
    }
  };
}

const emptyList = [];

function mapStateToProps(state: IState): IConnectedProps {
  return {
    subscriber: state.session.browser.subscriber || undefined,
    instructions: state.session.browser.instructions || undefined,
    url: state.session.browser.url || undefined,
    skippable: state.session.browser.skippable || undefined,
    notifications: state.session.notifications.notifications || emptyList,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<IState, null, Redux.Action>,
): IActionProps {
  return {
    onClose: () => dispatch(closeBrowser()),
    onNotification: (notification: INotification) =>
      dispatch(addNotification(notification)),
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(BrowserView),
) as React.ComponentClass<IBaseProps>;
