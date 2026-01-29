import * as _ from "lodash";
import * as React from "react";
import { Panel } from "react-bootstrap";
import * as ReactDOM from "react-dom";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import {
  actions,
  ComponentEx,
  FlexLayout,
  log,
  MainPage,
  Spinner,
  tooltip,
  types,
  util,
  Webview,
} from "vortex-api";
import { ThemeToCSS } from "../ThemeToCSS";

// Default documentation webview "landing".
const VORTEX_DOCUMENTS_URL = "https://github.com/Nexus-Mods/Vortex/wiki";
const ALLOWED_DOMAINS = [
  "https://nexus-mods.github.io",
  "https://modding.wiki",
  "https://github.com/nexus-mods/vortex/wiki",
];

const LOGIN_URL = "https://modding.wiki/login";
interface IComponentState {
  loading: boolean;
  history: string[];
  historyIdx: number;
}

interface IActionProps {
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions,
  ) => void;
}

type IProps = IActionProps;

class DocumentationView extends ComponentEx<IProps, IComponentState> {
  private mRef: Webview = null;
  private mWebView: any;
  private mCallbacks: { [event: string]: (...args: any[]) => void };
  private mMounted: boolean;

  constructor(props: IProps) {
    super(props);
    this.initState({
      loading: false,
      history: [VORTEX_DOCUMENTS_URL],
      historyIdx: 0,
    });

    this.mCallbacks = {
      "did-finish-load": () => {
        const newUrl: string = this.mWebView.getURL();
        if (newUrl.toLowerCase() === LOGIN_URL) {
          this.navigate(this.state.history[this.state.historyIdx]);
          util.opn(newUrl).catch(() => null);
          return;
        }
        const isAllowed = ALLOWED_DOMAINS.some((domain) =>
          newUrl.toLowerCase().startsWith(domain),
        );
        if (!isAllowed) {
          this.onExternalLink(newUrl);
          return;
        }

        if (newUrl !== this.nextState.history[this.nextState.historyIdx]) {
          this.nextState.history.splice(
            this.nextState.historyIdx + 1,
            9999,
            newUrl,
          );
          ++this.nextState.historyIdx;
        }

        const cssString = ThemeToCSS.getCSSInjectString(this.getThemeSheet());
        this.mWebView.insertCSS(cssString);
      },
    };
  }

  public componentDidMount() {
    this.mMounted = true;
    this.context.api.events.on("navigate-knowledgebase", this.navigate);
  }

  public componentWillUnmount() {
    this.context.api.events.removeListener(
      "navigate-knowledgebase",
      this.navigate,
    );
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { loading, history, historyIdx } = this.state;

    return (
      <MainPage>
        <MainPage.Header>
          <div className="header-navigation">
            <tooltip.IconButton
              icon="nav-back"
              onClick={this.navBack}
              disabled={historyIdx === 0}
              tooltip={t("Back")}
            />
            <tooltip.IconButton
              icon="highlight-home"
              onClick={this.navHome}
              disabled={historyIdx === 0}
              tooltip={t("Home")}
            />
            <tooltip.IconButton
              icon="nav-forward"
              onClick={this.navForward}
              disabled={historyIdx === history.length - 1}
              tooltip={t("Forward")}
            />
          </div>
          <div className="flex-fill" />
          <div className="header-navigation-right">
            <tooltip.IconButton
              icon="open-in-browser"
              onClick={this.openBrowser}
              tooltip={t("Open in Browser")}
            />
          </div>
        </MainPage.Header>
        <MainPage.Body>
          <FlexLayout type="column" className="documentation">
            <Panel>
              <Panel.Body>
                {loading ? this.renderWait() : null}
                <Webview
                  style={{
                    visibility: loading ? "hidden" : "visible",
                    width: "100%",
                    height: loading ? 0 : "100%",
                  }}
                  src={VORTEX_DOCUMENTS_URL}
                  onLoading={this.onLoading}
                  ref={this.setRef}
                />
              </Panel.Body>
            </Panel>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private onExternalLink = (link: string) => {
    const { onShowDialog } = this.props;
    this.navigate(this.state.history[this.state.historyIdx]);
    onShowDialog(
      "question",
      "External Link",
      {
        text:
          "For your safety the knowledge base browser is limited to Vortex's GitHub wiki domain. " +
          "A link you've clicked lies outside this domain and can only be viewed in your regular " +
          "browser - please ensure you trust the URL below before allowing Vortex to open that page " +
          "in your default browser.",
        message: link,
      },
      [
        { label: "Cancel" },
        { label: "Continue", action: () => util.opn(link).catch(() => null) },
      ],
    );
  };

  private onLoading = (loading: boolean) => {
    this.nextState.loading = loading;
  };

  private navigate = (url: string) => {
    if (this.mMounted) {
      try {
        this.mWebView.stop();
        this.mWebView.src = url;
        this.nextState.loading = false;
      } catch (err) {
        log("warn", "failed to navigate", { url, error: err.message });
      }
    }
  };

  private renderWait() {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <Spinner
          style={{
            width: "64px",
            height: "64px",
          }}
        />
      </div>
    );
  }

  private navBack = () => {
    const { history, historyIdx } = this.state;
    const newPos = Math.max(0, historyIdx - 1);
    this.nextState.historyIdx = newPos;
    this.mWebView.loadURL(history[newPos]);
  };

  private navHome = () => {
    const { history, historyIdx } = this.state;
    const newPos = Math.min(history.length - 1, historyIdx + 1);
    this.nextState.historyIdx = newPos;
    this.mWebView.loadURL(VORTEX_DOCUMENTS_URL);
  };

  private navForward = () => {
    const { history, historyIdx } = this.state;
    const newPos = Math.min(history.length - 1, historyIdx + 1);
    this.nextState.historyIdx = newPos;
    this.mWebView.loadURL(history[newPos]);
  };

  private openBrowser = () => {
    const { history, historyIdx } = this.state;
    util.opn(history[historyIdx]).catch((err) => null);
  };

  private setRef = (ref) => {
    this.mRef = ref;
    if (ref !== null) {
      this.mWebView = ReactDOM.findDOMNode(this.mRef);
      Object.keys(this.mCallbacks).forEach((event) => {
        this.mWebView.addEventListener(event, this.mCallbacks[event]);
      });
    } else {
      Object.keys(this.mCallbacks).forEach((event) => {
        this.mWebView.removeEventListener(event, this.mCallbacks[event]);
      });
    }
  };

  private getThemeSheet(): CSSStyleRule[] {
    for (let i = 0; i < document.styleSheets.length; ++i) {
      if ((document.styleSheets[i].ownerNode as any).id === "theme") {
        return Array.from((document.styleSheets[i] as any).rules);
      }
    }
    return [];
  }
}

function mapStateToProps(state: types.IState): any {
  return {};
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(
  withTranslation(["common"])(
    DocumentationView as any,
  ) as React.ComponentClass<IProps>,
);
