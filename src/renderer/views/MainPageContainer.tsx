import ExtensionGate from "../controls/ExtensionGate";
import Icon from "../controls/Icon";
import type { IMainPage } from "../../types/IMainPage";
import { didIgnoreError, isOutdated } from "../../util/errorHandling";
import { genHash } from "../../util/genHash";
import { log } from "../../util/log";
import { MainContext } from "./MainWindow";

import * as React from "react";
import { Alert, Button, Jumbotron } from "react-bootstrap";
import { getApplication } from "../../util/application";
import { useTranslation } from "react-i18next";

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

export interface IPageHeaderContext {
  headerPortal: () => HTMLElement;
  page: string;
}

export const PageHeaderContext = React.createContext<IPageHeaderContext>({
  headerPortal: () => null,
  page: "",
});

interface IErrorBoundaryProps {
  pageId: string;
  classes: string[];
  children: React.ReactNode;
}

interface IErrorBoundaryState {
  error: Error | undefined;
  errorInfo: React.ErrorInfo | undefined;
}

// Error boundaries must be class components - no hook equivalent exists
class PageErrorBoundary extends React.Component<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  constructor(props: IErrorBoundaryProps) {
    super(props);
    this.state = { error: undefined, errorInfo: undefined };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
  }

  public render() {
    const { error, errorInfo } = this.state;
    const { pageId, classes, children } = this.props;

    if (error !== undefined) {
      return (
        <ErrorFallback
          pageId={pageId}
          classes={classes}
          error={error}
          errorInfo={errorInfo}
          onRetry={() =>
            this.setState({ error: undefined, errorInfo: undefined })
          }
        />
      );
    }

    return children;
  }
}

interface IErrorFallbackProps {
  pageId: string;
  classes: string[];
  error: Error;
  errorInfo: React.ErrorInfo;
  onRetry: () => void;
}

const ErrorFallback: React.FC<IErrorFallbackProps> = ({
  pageId,
  classes,
  error,
  errorInfo,
  onRetry,
}) => {
  const { t } = useTranslation(["common"]);
  const context = React.useContext(MainContext);

  const report = React.useCallback(() => {
    context.api.events.emit(
      "report-feedback",
      error.stack.split("\n")[0],
      `Component rendering error

Vortex Version: ${getApplication().version},

${error.stack}

ComponentStack:
  ${errorInfo.componentStack}
`,
      [],
      genHash(error),
    );
  }, [context.api, error, errorInfo]);

  return (
    <div id={`page-${pageId}`} className={classes.join(" ")}>
      <Alert className="render-failure" bsStyle="danger">
        <Icon className="render-failure-icon" name="sad" />
        <div className="render-failure-text">{t("Failed to render.")}</div>
        <div className="render-failure-buttons">
          {isOutdated() || didIgnoreError() ? null : (
            <Button onClick={report}>{t("Report")}</Button>
          )}
          <Button onClick={onRetry}>{t("Retry")}</Button>
        </div>
      </Alert>
    </div>
  );
};

export const MainPageContainer: React.FC<IBaseProps> = ({
  page,
  active,
  secondary,
}) => {
  const { t } = useTranslation(["common"]);
  const [headerRef, setHeaderRef] = React.useState<HTMLElement | null>(null);

  const classes = React.useMemo(() => {
    const result = ["main-page"];
    result.push(active ? "page-active" : "page-hidden");
    if (secondary) {
      result.push("secondary");
    }
    return result;
  }, [active, secondary]);

  const headerContextValue = React.useMemo<IPageHeaderContext>(
    () => ({
      headerPortal: () => headerRef,
      page: page.id,
    }),
    [headerRef, page.id],
  );

  const handleHeaderRef = React.useCallback((ref: HTMLElement | null) => {
    setHeaderRef(ref);
  }, []);

  // Render the page content
  let content: JSX.Element;
  try {
    const props = page.propsFunc();
    content = (
      <PageHeaderContext.Provider value={headerContextValue}>
        <div id={`page-${page.id}`} className={classes.join(" ")}>
          <div className="mainpage-header-container" ref={handleHeaderRef} />
          <div className="mainpage-body-container">
            <ExtensionGate id={page.id}>
              <page.component
                active={active}
                secondary={secondary}
                {...props}
              />
            </ExtensionGate>
          </div>
        </div>
      </PageHeaderContext.Provider>
    );
  } catch (err) {
    log("warn", "error rendering extension main page", err);
    content = (
      <div className={classes.join(" ")}>
        <Jumbotron>
          <h4>{t("Unavailable")}</h4>
        </Jumbotron>
      </div>
    );
  }

  return (
    <PageErrorBoundary pageId={page.id} classes={classes}>
      {content}
    </PageErrorBoundary>
  );
};

export default MainPageContainer;
