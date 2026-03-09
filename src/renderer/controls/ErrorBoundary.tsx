import { ComponentEx, translate } from "./ComponentEx";
import { didIgnoreError, isOutdated } from "../util/errorHandling";
import { genHash } from "../util/genHash";
import { renderError } from "../util/message";

import Icon from "./Icon";
import { IconButton } from "./TooltipControls";

import * as _ from "lodash";
import * as React from "react";
import { Alert, Button } from "react-bootstrap";
import type { WithTranslation } from "react-i18next";
import { getApplication } from "../util/application";
import { unknownToError } from "@vortex/shared";

export type CBFunction = (...args: any[]) => void;

export interface IErrorContext {
  safeCB: (cb: CBFunction, dependencyList?: any[]) => CBFunction;
}

export const ErrorContext = React.createContext<IErrorContext>({
  safeCB: (cb) => cb,
});

export interface IBaseProps {
  visible?: boolean;
  onHide?: () => void;
  className?: string;
  canDisplayError?: boolean;
}

export interface IErrorBoundaryProps extends IBaseProps, WithTranslation {}

interface IErrorBoundaryState {
  error: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends ComponentEx<
  IErrorBoundaryProps,
  IErrorBoundaryState
> {
  private mErrContext: IErrorContext;
  constructor(props: IErrorBoundaryProps) {
    super(props);

    this.state = {
      error: undefined,
      errorInfo: undefined,
    };

    this.mErrContext = {
      safeCB: (cb: CBFunction): CBFunction => {
        return (...args) => {
          try {
            cb(...args);
          } catch (err) {
            this.setState({ error: unknownToError(err) });
          }
        };
      },
    };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.canDisplayError === false) {
      this.context.api.sendNotification({
        type: "error",
        message: "Failed to render",
        actions: [
          {
            title: "More",
            action: () => {
              const rendered = renderError(error);
              this.context.api.showDialog(
                "error",
                "Failed to render",
                {
                  message: rendered.message,
                  text: rendered.text,
                  options: {
                    wrap: rendered.wrap,
                    translated: rendered.translated,
                  },
                  parameters: {
                    ...(rendered.parameters || {}),
                  },
                },
                [{ label: "Close" }],
              );
            },
          },
          {
            title: "Retry",
            action: () => {
              this.retryRender();
            },
          },
          {
            title: "Report",
            action: () => {
              this.report();
            },
          },
        ],
      });
    }
    this.setState({ error, errorInfo });
  }

  public render(): React.ReactNode {
    const { t, className, canDisplayError, onHide, visible } = this.props;
    const { error } = this.state;

    if (error === undefined) {
      return (
        <ErrorContext.Provider value={this.mErrContext}>
          {React.Children.only(this.props.children)}
        </ErrorContext.Provider>
      );
    } else if (canDisplayError === false) {
      return null;
    }

    const classes = (className || "").split(" ");
    classes.push("errorboundary");

    return visible ? (
      <div className={classes.join(" ")}>
        <Alert className="render-failure" bsStyle="danger">
          <Icon className="render-failure-icon" name="sad" />
          <div className="render-failure-text">{t("Failed to render.")}</div>
          <div className="render-failure-buttons">
            {isOutdated() || didIgnoreError() ? null : (
              <Button onClick={this.report}>{t("Report")}</Button>
            )}
            <Button onClick={this.retryRender}>{t("Retry")}</Button>
          </div>
          {onHide !== undefined ? (
            <IconButton
              className="error-boundary-close"
              tooltip={t("Hide")}
              icon="close"
              onClick={onHide}
            />
          ) : null}
        </Alert>
      </div>
    ) : null;
  }

  private report = () => {
    const { events } = this.context.api;
    const { onHide } = this.props;
    const { error, errorInfo } = this.state;
    if (error === undefined || errorInfo === undefined) {
      return;
    }
    if (onHide !== undefined) {
      onHide();
    }
    let errMessage =
      "Component rendering error\n\n" +
      `Vortex Version: ${getApplication().version}\n\n` +
      `${error.stack}`;

    if (errorInfo !== undefined) {
      errMessage += "\n\nComponentStack:" + errorInfo.componentStack + "\n";
    }

    events.emit(
      "report-feedback",
      error.stack.split("\n")[0],
      errMessage,
      [],
      genHash(error),
    );
  };

  private retryRender = () => {
    this.setState({ error: undefined, errorInfo: undefined });
  };
}

export default translate(["common"])(ErrorBoundary);

/**
 * Higher-Order-Component that provides the component with a safeCB callback wrapper
 * which will get all exceptions from the callback forwarded to the nearest ErrorBoundary
 * so that they get reported properly instead of remaining unhandled.
 */
export function safeCallbacks<T, S>(
  ComponentToWrap: React.ComponentType<React.PropsWithChildren<T>>,
): React.ComponentType<Omit<T, keyof IErrorContext>> {
  // tslint:disable-next-line:class-name
  // return class __SafeCallbackComponent extends React.Component<T, S> {
  const cache: { [key: string]: { cb: CBFunction; depList: any[] } } = {};

  return (props: React.PropsWithChildren<T>) => {
    const context = React.useContext(ErrorContext);

    const cachingSafeCB = React.useCallback(
      (cb: (...args: any[]) => void, depList?: any[]) => {
        const id = cb.toString();
        if (
          cache[id] === undefined ||
          (depList !== undefined && !_.isEqual(depList, cache[id].depList))
        ) {
          cache[id] = { cb: context.safeCB(cb, []), depList };
        }
        return cache[id].cb;
      },
      [context],
    );

    return React.createElement(
      ComponentToWrap,
      {
        ...props,
        safeCB: cachingSafeCB,
      },
      props.children,
    );
  };
}
