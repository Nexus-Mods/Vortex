import React, {
  Component,
  type FC,
  useCallback,
  type ReactNode,
  useState,
  useMemo,
  type JSX,
} from "react";
import { Alert, Button, Jumbotron } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import type { IMainPage } from "../types/IMainPage";

import { useMainContext } from "../contexts";
import {
  PageHeaderProvider,
  type IPageHeaderContext,
  PageHeaderContext,
} from "../contexts/MainPageHeaderContext";
import ExtensionGate from "../controls/ExtensionGate";
import Icon from "../controls/Icon";
import { getApplication } from "../util/application";
import { didIgnoreError, isOutdated } from "../util/errorHandling";
import { genHash } from "../util/genHash";
import { log } from "../util/log";

// Backward compatibility export
export { type IPageHeaderContext, PageHeaderContext };

export interface IBaseProps {
  page: IMainPage;
  active: boolean;
  secondary: boolean;
}

export interface IMainPageContext {
  globalOverlay: JSX.Element;
}

interface IErrorBoundaryProps {
  pageId: string;
  classes: string[];
  children: ReactNode;
}

interface IErrorBoundaryState {
  error: Error | undefined;
  errorInfo: React.ErrorInfo | undefined;
}

// Error boundaries must be class components - no hook equivalent exists
class PageErrorBoundary extends Component<
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
          classes={classes}
          error={error}
          errorInfo={errorInfo}
          pageId={pageId}
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

const ErrorFallback: FC<IErrorFallbackProps> = ({
  pageId,
  classes,
  error,
  errorInfo,
  onRetry,
}) => {
  const { t } = useTranslation(["common"]);
  const context = useMainContext();

  const report = useCallback(() => {
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
    <div className={classes.join(" ")} id={`page-${pageId}`}>
      <Alert bsStyle="danger" className="render-failure">
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
  const [headerRef, setHeaderRef] = useState<HTMLElement | null>(null);

  const classes = useMemo(() => {
    const result = ["main-page"];
    result.push(active ? "page-active" : "page-hidden");
    if (secondary) {
      result.push("secondary");
    }
    return result;
  }, [active, secondary]);

  const headerContextValue = useMemo<IPageHeaderContext>(
    () => ({
      headerPortal: () => headerRef,
      page: page.id,
    }),
    [headerRef, page.id],
  );

  const handleHeaderRef = useCallback((ref: HTMLElement | null) => {
    setHeaderRef(ref);
  }, []);

  // Render the page content
  let content: JSX.Element;
  try {
    const props = page.propsFunc();
    content = (
      <PageHeaderProvider value={headerContextValue}>
        <div className={classes.join(" ")} id={`page-${page.id}`}>
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
      </PageHeaderProvider>
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
    <PageErrorBoundary classes={classes} pageId={page.id}>
      {content}
    </PageErrorBoundary>
  );
};

export default MainPageContainer;
