import {
  addFeedbackFile,
  clearFeedbackFiles,
  removeFeedbackFile,
} from "../actions/session";
import type { FeedbackTopic, FeedbackType } from "../types/feedbackTypes";
import type { IFeedbackFile } from "../types/IFeedbackFile";

import { partial_ratio } from "fuzzball";
import * as React from "react";
import {
  Alert,
  ControlLabel,
  DropdownButton,
  FormControl,
  FormGroup,
  ListGroup,
  ListGroupItem,
  MenuItem,
  Panel,
} from "react-bootstrap";
import { Trans, withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as Redux from "redux";
import { ThunkDispatch } from "redux-thunk";
import {
  actions,
  ComponentEx,
  Dropzone,
  EmptyPlaceholder,
  FlexLayout,
  FormInput,
  log,
  MainPage,
  Toggle,
  tooltip,
  types,
  Usage,
  util,
} from "vortex-api";

type ControlMode = "urls" | "files";

interface IFeedbackViewProps {
  readReferenceIssues: () => Promise<IPreviewIssue[]>;
  identifyAttachment: (
    filePath: string,
    type?: string,
  ) => Promise<IFeedbackFile>;
  logPath: (fileName: string) => string;
  dumpStateToFile: (stateKey: string, name: string) => Promise<IFeedbackFile>;
  dumpReduxActionsToFile: (name: string) => Promise<IFeedbackFile>;
  removeFiles: (fileNames: string[]) => Promise<void>;
}

interface IConnectedProps {
  feedbackType: FeedbackType;
  feedbackTopic: FeedbackTopic;
  feedbackTitle: string;
  feedbackMessage: string;
  feedbackHash: string;
  feedbackFiles: { [fileId: string]: IFeedbackFile };
  APIKey: string;
  OAuthCredentials: any;
  newestVersion: string;
}

interface IActionProps {
  onShowActivity: (message: string, id?: string) => void;
  onDismissNotification: (id: string) => void;
  onRemoveFeedbackFile: (feedbackFileId: string) => void;
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions,
  ) => void;
  onShowError: (
    message: string,
    details?: string | Error,
    notificationId?: string,
    allowReport?: boolean,
  ) => void;
  onClearFeedbackFiles: () => void;
  onAddFeedbackFile: (feedbackFile: IFeedbackFile) => void;
}

type IProps = IFeedbackViewProps & IConnectedProps & IActionProps;

interface IComponentState {
  feedbackType: FeedbackType;
  feedbackTopic: FeedbackTopic;
  feedbackTitle: string;
  feedbackMessage: string;
  filteredIssues: any[];
  titleFocused: boolean;
  anonymous: boolean;
  sending: boolean;
}

interface IPreviewIssue {
  type: string;
  title: string;
  url: string;
  keywords: string[];
}

const SAMPLE_REPORT_BUG =
  "E.g.:\n" +
  "Summary: The mod downloads properly but when I try to install it nothing happens.\n" +
  "Expected Results: The mod is installed.\n" +
  "Actual Results: Nothing happens.\n" +
  "Steps to reproduce: Download a mod, then click Install inside the Actions menu.";

const SAMPLE_REPORT_SUGGESTION =
  "E.g.:\n" +
  "Summary: Please add a way to see the size of a mod on disk\n" +
  // tslint:disable-next-line:max-line-length
  "Rationale: Space on my games partition is too limited so I want to delete the biggest, uninstalled mods.\n" +
  "Proposed Implementation: Add a column to the mods page that shows the size of the mod size.";

class FeedbackPage extends ComponentEx<IProps, IComponentState> {
  private static MAX_ATTACHMENT_SIZE = 40 * 1024 * 1024;
  private static MIN_TITLE_LENGTH = 10;
  private static MIN_TEXT_LENGTH = 50;
  private issues: IPreviewIssue[] = [];
  constructor(props: IProps) {
    super(props);

    this.initState({
      feedbackType: props.feedbackType,
      feedbackTopic: props.feedbackTopic,
      feedbackTitle: props.feedbackTitle,
      feedbackMessage: props.feedbackMessage,
      filteredIssues: [],
      titleFocused: false,
      anonymous: false,
      sending: false,
    });
  }

  public componentDidMount() {
    (async () => {
      try {
        this.issues = await this.props.readReferenceIssues();
      } catch (err) {
        log("error", "failed to read issue preview", err.message);
      }
    })();
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.feedbackType !== newProps.feedbackType) {
      this.nextState.feedbackType = newProps.feedbackType;
    }
    if (this.props.feedbackTopic !== newProps.feedbackTopic) {
      this.nextState.feedbackTopic = newProps.feedbackTopic;
    }
    if (this.props.feedbackMessage !== newProps.feedbackMessage) {
      this.nextState.feedbackMessage = newProps.feedbackMessage;
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { feedbackType } = this.state;

    const content = this.context.api.isOutdated()
      ? this.renderOutdated()
      : this.renderContent();

    if (!feedbackType) {
      return this.renderStartScreen();
    }

    return (
      <MainPage>
        <FlexLayout type="column">
          <DropdownButton
            id="feedback-type-dropdown"
            title={t(this.renderType(this.state.feedbackType))}
            onSelect={this.handleChangeType}
          >
            <MenuItem eventKey="bugreport">
              {t(this.renderType("bugreport"))}
            </MenuItem>
            <MenuItem eventKey="suggestion">
              {t(this.renderType("suggestion"))}
            </MenuItem>
            <MenuItem eventKey="question">
              {t(this.renderType("question"))}
            </MenuItem>
          </DropdownButton>
          {content}
        </FlexLayout>
      </MainPage>
    );
  }

  private renderStartScreen(): JSX.Element {
    const { t } = this.props;
    return (
      <MainPage>
        <FlexLayout type="column" className="feedback-type-selection">
          <FlexLayout.Fixed>
            {t("Please select the type of Feedback you'd like to send in.")}
          </FlexLayout.Fixed>
          <FlexLayout.Fixed>
            <FlexLayout type="row">
              <FlexLayout.Fixed>
                <tooltip.IconButton
                  vertical
                  id="feedback-button-bug"
                  icon="bug"
                  tooltip={t("Report Bug")}
                  className="btn-ghost"
                  onClick={this.selectBug}
                >
                  {t(this.renderType("bugreport"))}
                </tooltip.IconButton>
              </FlexLayout.Fixed>
              <FlexLayout.Fixed>
                <tooltip.IconButton
                  vertical
                  id="feedback-button-suggestion"
                  icon="idea"
                  tooltip={t("Report Suggestion")}
                  className="btn-ghost"
                  onClick={this.selectSuggestion}
                >
                  {t(this.renderType("suggestion"))}
                </tooltip.IconButton>
              </FlexLayout.Fixed>
              <FlexLayout.Fixed>
                <tooltip.IconButton
                  vertical
                  id="feedback-button-question"
                  icon="support"
                  tooltip={t("Ask Question")}
                  className="btn-ghost"
                  onClick={this.selectQuestion}
                >
                  {t(this.renderType("question"))}
                </tooltip.IconButton>
              </FlexLayout.Fixed>
            </FlexLayout>
          </FlexLayout.Fixed>
          <FlexLayout.Fixed>
            <Alert bsStyle="warning">
              {t(
                "Please understand that this is only for feedback for the " +
                  '"Vortex" application, all feedback regarding the website ' +
                  '"Nexus Mods" will be ignored.',
              )}
            </Alert>
          </FlexLayout.Fixed>
        </FlexLayout>
      </MainPage>
    );
  }

  private renderType(type: FeedbackType): string {
    return (
      {
        bugreport: "Bug Report",
        suggestion: "Suggestion",
        question: "Question",
      }[type] || "Select Report Type"
    );
  }

  private renderTopic(feedbackTopic: FeedbackTopic): string {
    return (
      {
        crash: "Crash",
        login_problems: "Login Problem",
        slow_downloads: "Slow Downloads",
        other: "Other",
      }[feedbackTopic] || "Unknown"
    );
  }

  private renderOutdated() {
    const { t } = this.props;
    return (
      <FlexLayout.Flex fill>
        <h2>{t("Provide Feedback")}</h2>
        <EmptyPlaceholder
          icon="auto-update"
          text={t("Vortex outdated")}
          fill={true}
          subtext={t(
            "Sorry, due to large amount of feedback we receive we can't accept feedback " +
              "from older versions since the issue may already have been addressed.",
          )}
        />
      </FlexLayout.Flex>
    );
  }

  private renderContent() {
    const { feedbackType } = this.state;
    const renderFunc =
      {
        bugreport: this.renderContentBugReport,
        suggestion: this.renderContentSuggestion,
        question: this.renderContentQuestion,
      }[feedbackType] || this.renderNoType;
    return renderFunc();
  }

  private renderNoType = () => {
    const { t } = this.props;

    return (
      <div className="feedback-instructions-notype">
        {t("Please select the type of Feedback you'd like to send in.")}
      </div>
    );
  };

  private renderContentQuestion = () => {
    const T: any = Trans;

    return (
      <T
        i18nKey="feedback-instructions-question"
        className="feedback-instructions-notype"
      >
        <p>
          Sorry but this is not the right way to ask for help with Vortex. The
          feedback system is intended to inform us about problems or possible
          improvement and we can only reply to ask for further information. To
          get help, please consult the knowledge base or visit the forum at
        </p>
        <a onClick={this.openSupportForum}>
          https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/
        </a>
        <p>There the entire community can help you.</p>
      </T>
    );
  };

  private renderContentSuggestion = () => {
    const T: any = Trans;
    return (
      <T
        i18nKey="feedback-instructions-suggestion"
        className="feedback-instructions-notype"
      >
        <p>
          Share your ideas and feature requests, discuss them with the
          community, and cast your vote on feedback provided by others using our
          Feedback board at
        </p>
        <a onClick={this.openFeedbackPage}>
          https://feedback.nexusmods.com/?tags=vortex
        </a>
      </T>
    );
  };

  private renderContentBugReport = () => {
    const { t, feedbackFiles } = this.props;
    const { feedbackTopic } = this.state;

    const titleValid = this.validateTitle();
    const messageValid = this.validateMessage();

    const maySend =
      (titleValid === undefined || titleValid.valid) &&
      messageValid === undefined;

    const fields = [
      <FlexLayout.Fixed key="title-label" className="hide-when-small">
        <h4>{t("Title")}</h4>
      </FlexLayout.Fixed>,
      <FlexLayout.Fixed key="title-input">
        {this.renderTitleInput(titleValid)}
      </FlexLayout.Fixed>,
      <FlexLayout.Fixed key="sysinfo-label" className="hide-when-small">
        <h4>{t("System Information")}</h4>
      </FlexLayout.Fixed>,
      <FlexLayout.Fixed key="sysinfo-data">
        <div className="feedback-system-info">{this.systemInfo()}</div>
      </FlexLayout.Fixed>,
      <FlexLayout.Fixed key="message-label" className="hide-when-small">
        <h4>{t("Your Message")}</h4>
      </FlexLayout.Fixed>,
      <FlexLayout.Flex key="message-input">
        {this.renderMessageArea(messageValid)}
      </FlexLayout.Flex>,
      <FlexLayout.Flex className="feedback-file-drop-flex" key="files-dropzone">
        <Dropzone
          accept={["files"]}
          icon="folder-download"
          drop={this.dropFeedback}
          dropText="Drop files to attach"
          clickText="Click to browse for files to attach"
          dialogHint={t("Select file to attach")}
        />
      </FlexLayout.Flex>,
      <FlexLayout.Fixed key="attach-button">
        {t("or")}
        {this.renderAttachButton()}
      </FlexLayout.Fixed>,
      <FlexLayout.Fixed key="files-list">
        <ListGroup className="feedback-files">
          {Object.keys(feedbackFiles).map(this.renderFeedbackFile)}
        </ListGroup>
        {this.renderFilesArea(maySend)}
      </FlexLayout.Fixed>,
    ];

    const T: any = Trans;
    const PanelX: any = Panel;
    return [
      <FlexLayout.Fixed key="feedback-instructions">
        <h4>
          {t(
            "Describe in detail what you were doing and the feedback " +
              "you would like to submit.",
          )}
        </h4>
        <Usage persistent infoId="feedback-bugreport-instructions">
          <T i18nKey="feedback-instructions" className="feedback-instructions">
            Please
            <br />
            <ul>
              <li>use punctuation and linebreaks,</li>
              <li>use English,</li>
              <li>
                be precise and to the point. You don&apos;t have to form
                sentences. A bug report is a technical document, not prose,
              </li>
              <li>report only one thing per message,</li>
              <li>
                avoid making assumptions or your own conclusions, just report
                what you saw and what you expected to see,
              </li>
              <li>
                include an example of how to reproduce the error if you can.
                Even if its a general problem (&quot;fomods using feature x zig
                when they should zag&quot;) include one sequence of actions that
                expose the problem.
              </li>
            </ul>
            Trying to reproduce a bug is usually what takes the most amount of
            time in bug fixing and the less time we spend on it, the more time
            we can spend creating great new features!
          </T>
        </Usage>
      </FlexLayout.Fixed>,
      <FlexLayout.Flex key="feedback-body">
        <Panel>
          <PanelX.Body>
            <FlexLayout type="column" className="feedback-form">
              <FlexLayout.Fixed className="hide-when-small">
                <h4>{t("Topic")}</h4>
              </FlexLayout.Fixed>
              <FlexLayout.Fixed>
                <FlexLayout type="row">
                  <FlexLayout.Fixed>
                    <DropdownButton
                      id="feedback-topic-dropdown"
                      title={t(this.renderTopic(feedbackTopic))}
                      onSelect={this.handleChangeTopic}
                    >
                      <MenuItem eventKey="crash">
                        {t(this.renderTopic("crash"))}
                      </MenuItem>
                      <MenuItem eventKey="login_problems">
                        {t(this.renderTopic("login_problems"))}
                      </MenuItem>
                      <MenuItem eventKey="slow_downloads">
                        {t(this.renderTopic("slow_downloads"))}
                      </MenuItem>
                      <MenuItem eventKey="other">
                        {t(this.renderTopic("other"))}
                      </MenuItem>
                    </DropdownButton>
                  </FlexLayout.Fixed>
                  <FlexLayout.Flex>
                    {this.renderTopicComment()}
                    {feedbackTopic === undefined ? (
                      <div>{t("Please select a topic")}</div>
                    ) : null}
                  </FlexLayout.Flex>
                </FlexLayout>
              </FlexLayout.Fixed>
              {feedbackTopic !== undefined ? fields : null}
            </FlexLayout>
          </PanelX.Body>
        </Panel>
      </FlexLayout.Flex>,
    ];
  };

  private renderTopicComment() {
    const { t } = this.props;
    const { feedbackTopic } = this.state;

    if (feedbackTopic === "slow_downloads") {
      return (
        <Alert bsStyle="warning">
          <div>
            {t(
              "Vortex does not impose any speed limitations on downloads, " +
                "that's handled by the server.",
            )}
          </div>
          <div>
            {t(
              "We can not forward your problems to the web department so please don't report " +
                "temporary speed issues or problems regarding the non-premium speed cap through " +
                "this form!",
            )}
          </div>
        </Alert>
      );
    } else if (feedbackTopic === "login_problems") {
      return (
        <Alert bsStyle="warning">
          {t(
            "Please make sure you've read the login instructions in Vortex, on the authorisation " +
              "page and consulted the knowledge base before reporting login issues.",
          )}
        </Alert>
      );
    }
  }

  private renderFeedbackFile = (feedbackFile: string) => {
    const { t, feedbackFiles } = this.props;
    return (
      <ListGroupItem key={feedbackFiles[feedbackFile].filename}>
        <p style={{ display: "inline" }}>
          {feedbackFiles[feedbackFile].filename}
        </p>
        <p style={{ display: "inline" }}>
          {" "}
          ({util.bytesToString(feedbackFiles[feedbackFile].size)})
        </p>
        <tooltip.IconButton
          className="btn-embed btn-line-right"
          id={feedbackFiles[feedbackFile].filename}
          key={feedbackFiles[feedbackFile].filename}
          tooltip={t("Remove")}
          onClick={this.remove}
          icon="delete"
        />
      </ListGroupItem>
    );
  };

  private openIssues = () => {
    util.opn("https://github.com/Nexus-Mods/Vortex/issues").catch(() => null);
  };

  private openSupportForum = () => {
    util
      .opn("https://forums.nexusmods.com/index.php?/forum/4306-vortex-support")
      .catch(() => null);
  };

  private openFeedbackPage = () => {
    util.opn("https://feedback.nexusmods.com/?tags=vortex").catch(() => null);
  };

  private validateTitle(): { valid: boolean; text: string } {
    const { t } = this.props;
    const { feedbackTitle, filteredIssues } = this.state;

    if (
      feedbackTitle.length > 0 &&
      feedbackTitle.length < FeedbackPage.MIN_TITLE_LENGTH
    ) {
      return {
        valid: false,
        text: t("The title needs to be at least {{minLength}} characters", {
          replace: { minLength: FeedbackPage.MIN_TITLE_LENGTH },
        }),
      };
    }

    if (filteredIssues.length > 0) {
      return {
        valid: true,
        text: t(
          "This may be a known issue, please click the title again to see similar issues.",
        ),
      };
    }

    return undefined;
  }

  private validateMessage(): string {
    const { t } = this.props;
    const { feedbackMessage } = this.state;

    if (
      feedbackMessage.length > 0 &&
      feedbackMessage.length < FeedbackPage.MIN_TEXT_LENGTH
    ) {
      return t(
        "Please provide a meaningful description of at least {{minLength}} characters",
        { replace: { minLength: FeedbackPage.MIN_TEXT_LENGTH } },
      );
    }

    return undefined;
  }

  private async attachFile(filePath: string, type?: string): Promise<void> {
    try {
      this.addFeedbackFile(await this.props.identifyAttachment(filePath, type));
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  private dropFeedback = (type: ControlMode, feedbackFilePaths: string[]) => {
    if (feedbackFilePaths.length === 0) {
      return;
    }

    if (type === "files") {
      Promise.all(
        feedbackFilePaths.map((filePath) => {
          this.attachFile(filePath);
        }),
      ).then(() => null);
    }
  };

  private remove = (evt) => {
    const { onRemoveFeedbackFile } = this.props;
    const feedbackFileId = evt.currentTarget.id;
    onRemoveFeedbackFile(feedbackFileId);
  };

  private handleFocusTitle = (focused: boolean) => {
    // delay a bit, otherwise the links can't be clicked
    setTimeout(
      () => {
        this.nextState.titleFocused = focused;
      },
      focused ? 100 : 1000,
    );
  };

  private tagName(type: string) {
    return (
      {
        wiki: "Wiki",
        faq: "FAQ",
        issue: "Tracker",
      }[type] || "???"
    );
  }

  private renderSearchResult = (iss: any, idx: number) => {
    return (
      <div key={`${iss.title}-${idx}`}>
        <div className="feedback-result-tag">{this.tagName(iss.type)}</div>{" "}
        <a data-url={iss.url} onClick={this.openIssue}>
          {iss.title}
        </a>
      </div>
    );
  };

  private openIssue = (evt) => {
    const url = evt.currentTarget.getAttribute("data-url");
    util.opn(url).catch(() => null);
  };

  private renderTitleInput = (validationMessage: {
    valid: boolean;
    text: string;
  }) => {
    const { t } = this.props;
    const { feedbackTitle, filteredIssues, titleFocused } = this.state;

    const validationState =
      validationMessage === undefined
        ? null
        : validationMessage.valid
          ? "warning"
          : "error";

    return (
      <FormGroup validationState={validationState}>
        <FormInput
          id="feedback-input"
          label={t("Title")}
          value={feedbackTitle}
          onChange={this.handleChangeTitle}
          onFocus={this.handleFocusTitle}
          placeholder={t("Please provide a title")}
          debounceTimer={50}
        />
        {filteredIssues.length > 0 && titleFocused ? (
          <div className="feedback-search-result">
            {filteredIssues.map((issue, idx) =>
              this.renderSearchResult(issue, idx),
            )}
          </div>
        ) : null}
        {validationMessage === undefined ? null : (
          <ControlLabel>{validationMessage.text}</ControlLabel>
        )}
      </FormGroup>
    );
  };

  private renderMessageArea = (validationMessage: string) => {
    const { t } = this.props;
    const { feedbackMessage, feedbackType } = this.state;
    return (
      <FormGroup
        validationState={validationMessage !== undefined ? "error" : null}
        style={{ height: "100%" }}
      >
        <FlexLayout type="column">
          <FlexLayout.Flex>
            <FormControl
              componentClass="textarea"
              value={feedbackMessage || ""}
              id="textarea-feedback"
              className="textarea-feedback"
              onChange={this.handleChange}
              placeholder={t(
                feedbackType === "suggestion"
                  ? SAMPLE_REPORT_SUGGESTION
                  : SAMPLE_REPORT_BUG,
              )}
            />
          </FlexLayout.Flex>
          {validationMessage === undefined ? null : (
            <FlexLayout.Fixed>
              <ControlLabel>{validationMessage}</ControlLabel>
            </FlexLayout.Fixed>
          )}
        </FlexLayout>
      </FormGroup>
    );
  };

  private renderAttachButton(): JSX.Element {
    const { t } = this.props;
    return (
      <DropdownButton
        id="btn-attach-feedback"
        title={t("Attach Special File")}
        onSelect={this.attach}
        dropup
      >
        <MenuItem eventKey="log">{t("Vortex Log")}</MenuItem>
        <MenuItem eventKey="netlog">{t("Vortex Network Log")}</MenuItem>
        <MenuItem eventKey="settings">{t("Application Settings")}</MenuItem>
        <MenuItem eventKey="state">{t("Application State")}</MenuItem>
        <MenuItem eventKey="actions">{t("Recent State Changes")}</MenuItem>
      </DropdownButton>
    );
  }

  private renderFilesArea(valid: boolean): JSX.Element {
    const { t, APIKey, OAuthCredentials } = this.props;
    const { anonymous, feedbackTitle, feedbackMessage, sending } = this.state;

    const loggedIn = APIKey !== undefined || OAuthCredentials !== undefined;

    const anon = anonymous || !loggedIn;
    return (
      <FlexLayout fill={false} type="row" className="feedback-controls">
        <FlexLayout.Fixed>
          <Toggle
            checked={anon}
            onToggle={this.setAnonymous}
            disabled={!loggedIn}
          >
            {t("Send anonymously")}
          </Toggle>
          {!loggedIn ? (
            <Alert bsStyle="warning">
              {t(
                "You are not logged in. Please include your username in your message to give us a " +
                  "chance to reply.",
              )}
            </Alert>
          ) : anon ? (
            <Alert bsStyle="warning">
              {t(
                "If you send feedback anonymously we can not give you updates on your report " +
                  "or enquire for more details.",
              )}
            </Alert>
          ) : null}
        </FlexLayout.Fixed>
        <FlexLayout.Fixed>
          <tooltip.Button
            style={{ display: "block", marginLeft: "auto", marginRight: 0 }}
            id="btn-submit-feedback"
            tooltip={t("Submit Feedback")}
            onClick={this.submitFeedback}
            disabled={
              sending ||
              feedbackTitle.length === 0 ||
              feedbackMessage.length === 0 ||
              !valid
            }
          >
            {t("Submit Feedback")}
          </tooltip.Button>
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private setAnonymous = (value: boolean) => {
    this.nextState.anonymous = value;
  };

  private attach = (eventKey: any) => {
    const { t, onShowDialog } = this.props;
    switch (eventKey) {
      case "log":
        this.attachLog();
        break;
      case "netlog":
        this.attachNetLog();
        break;
      case "actions":
        this.attachActions("Action History");
        break;
      case "settings": {
        onShowDialog(
          "question",
          t("Confirm"),
          {
            message: t(
              "This will attach your Vortex setting to the report, not including " +
                "confidential data like usernames and passwords. " +
                "We have no control over what third-party extensions store in settings though.",
            ),
            options: { wrap: true },
          },
          [
            { label: "Cancel" },
            {
              label: "Continue",
              action: () => {
                this.attachState("settings", "Vortex Settings");
              },
            },
          ],
        );
        break;
      }
      case "state": {
        onShowDialog(
          "question",
          t("Confirm"),
          {
            message: t(
              "This will attach your Vortex state to the report. This includes information about " +
                "things like your downloaded and installed mods, games, profiles and categories. " +
                "These could be very useful for understanding your feedback but you have " +
                "to decide if you are willing to share this information. " +
                "We will, of course, treat your information as confidential.",
            ),
            options: { wrap: true },
          },
          [
            { label: "Cancel" },
            {
              label: "Continue",
              action: () => {
                this.attachState("persistent", "Vortex State");
              },
            },
          ],
        );
        break;
      }
    }
  };

  private systemInfo() {
    return [
      "Vortex Version: " + util["getApplication"]().version,
      "Memory: " +
        util.bytesToString((process as any).getSystemMemoryInfo().total * 1024),
      "System: " +
        `${util.getApplication()["platform"]} ${process.arch} (${util.getApplication()["platformVersion"]})`,
    ].join("\n");
  }

  private async attachState(stateKey: string, name: string) {
    try {
      this.addFeedbackFile(await this.props.dumpStateToFile(stateKey, name));
    } catch (err) {
      this.props.onShowError("Failed to attach state", err);
    }
  }

  private async attachActions(name: string) {
    try {
      this.addFeedbackFile(await this.props.dumpReduxActionsToFile(name));
    } catch (err) {
      this.props.onShowError("Failed to attach redux actions", err);
    }
  }

  private attachNetLog() {
    this.attachFile(this.props.logPath("network.log"), "log");
  }

  private attachLog() {
    this.attachFile(this.props.logPath("vortex.log"), "log");
    this.attachFile(this.props.logPath("vortex1.log"), "log");
  }

  private addFeedbackFile(file: IFeedbackFile) {
    const { onAddFeedbackFile, onShowDialog, feedbackFiles } = this.props;
    const size = Object.keys(feedbackFiles).reduce(
      (prev, key) => prev + feedbackFiles[key].size,
      0,
    );
    if (size + file.size > FeedbackPage.MAX_ATTACHMENT_SIZE) {
      onShowDialog(
        "error",
        "Attachment too big",
        {
          text: "Sorry, the combined file size must not exceed 40MB",
        },
        [{ label: "Ok" }],
      );
    } else {
      onAddFeedbackFile(file);
    }
  }

  private submitFeedback = () => {
    const { onShowError } = this.props;
    this.sanityCheckFeedback()
      .then(() => this.doSubmitFeedback())
      .catch((err) => {
        if (
          !(err instanceof util.UserCanceled) &&
          !(err instanceof util.ProcessCanceled)
        ) {
          onShowError("Failed to send feedback", err, undefined, false);
        }
      });
  };

  private sanityCheckFeedback(): Promise<void> {
    const { feedbackFiles } = this.props;
    const { feedbackTopic, feedbackType } = this.state;
    let sane = Promise.resolve();

    const logFile = Object.values(feedbackFiles).find(
      (file) => file.type === "log",
    );

    if (feedbackType === "bugreport" && logFile === undefined) {
      sane = sane.then(() =>
        this.context.api
          .showDialog(
            "question",
            "Bugreport without log file",
            {
              text:
                "You are about to submit a bug report without a log file. " +
                "Such reports are almost never enough for identifying the problem. " +
                "Due to the high volume of feedback we get we can not " +
                "follow up on reports missing such basic information. " +
                "If you proceed, please understand that we may overlook your report " +
                "if we can't tell what went wrong from the error message alone.",
            },
            [
              { label: "Cancel" },
              { label: "Continue without log" },
              { label: "Send with log" },
            ],
          )
          .then((result) => {
            if (result.action === "Cancel") {
              return Promise.reject(new util.UserCanceled());
            } else if (result.action === "Send with log") {
              this.attachLog();
            }
            return Promise.resolve();
          }),
      );
    }

    if (feedbackType === "bugreport" && feedbackTopic === "slow_downloads") {
      sane = sane.then(() =>
        this.context.api
          .showDialog(
            "question",
            "Slow downloads",
            {
              text:
                "You may have overlooked the big red warning where we explain " +
                "that slow downloads aren't usually (never so far) caused by " +
                "the client.\n" +
                "Your report is almost certainly going to be ignored " +
                "unless you have convincing evidence that your case " +
                "is actually caused by a bug Vortex.\n" +
                "We do *not* provide assistance for finding the reason for slow " +
                "downloads.\n" +
                "Thank you for your understanding.",
              checkboxes: [{ id: "sure", text: "Yes, I'm sure", value: false }],
            },
            [
              { label: "Cancel" },
              { label: "Abort" },
              { label: "Stop" },
              { label: "Proceed" },
              { label: "Reconsider" },
            ],
          )
          .then((result) => {
            if (result.action !== "Proceed" || !result.input.sure) {
              return Promise.reject(new util.UserCanceled());
            } else {
              return Promise.resolve();
            }
          }),
      );
    }

    return sane;
  }

  private doSubmitFeedback() {
    const {
      APIKey,
      OAuthCredentials,
      feedbackFiles,
      feedbackHash,
      onClearFeedbackFiles,
      onDismissNotification,
      onShowActivity,
      onShowDialog,
      onShowError,
    } = this.props;
    const {
      anonymous,
      feedbackType,
      feedbackTopic,
      feedbackTitle,
      feedbackMessage,
    } = this.state;

    const notificationId = "submit-feedback";
    onShowActivity("Submitting feedback", notificationId);

    this.nextState.sending = true;

    const files: string[] = [];
    Object.keys(feedbackFiles).forEach((key) => {
      files.push(feedbackFiles[key].filePath);
    });

    const loggedIn = APIKey !== undefined || OAuthCredentials !== undefined;

    const sendAnonymously = anonymous || !loggedIn;
    let title = feedbackTitle;
    if (feedbackType === "bugreport") {
      title = `${this.renderTopic(feedbackTopic)}: ${title}`;
    }

    this.context.api.events.emit(
      "submit-feedback",
      `${this.renderType(feedbackType)} - ${title}`,
      this.systemInfo() + "\n" + feedbackMessage,
      feedbackHash,
      files,
      sendAnonymously,
      (err: Error) => {
        this.nextState.sending = false;
        if (err !== null) {
          if (err.name === "ParameterInvalid") {
            onShowError(
              "Failed to send feedback",
              err.message,
              notificationId,
              false,
            );
          } else if ((err as any).body !== undefined) {
            onShowError(
              "Failed to send feedback",
              `${err.message} - ${(err as any).body}`,
              notificationId,
              false,
            );
          } else {
            onShowError("Failed to send feedback", err, notificationId, false);
          }
          return;
        } else {
          onShowDialog(
            "success",
            "Feedback sent",
            {
              text:
                "Thank you for your feedback!\n\n" +
                "Your feedback will be reviewed before it gets published.",
            },
            [{ label: "Close" }],
          );
        }

        this.nextState.feedbackTitle = "";
        this.nextState.feedbackMessage = "";

        let removeFiles: string[];

        if (feedbackFiles !== undefined) {
          removeFiles = Object.keys(feedbackFiles)
            .filter(
              (fileId) =>
                ["State", "Dump", "LogCopy"].indexOf(
                  feedbackFiles[fileId].type,
                ) !== -1,
            )
            .map((fileId) => feedbackFiles[fileId].filePath);
        }

        if (removeFiles !== undefined) {
          this.props
            .removeFiles(removeFiles)
            .then(() => {
              onClearFeedbackFiles();
              onDismissNotification(notificationId);
            })
            .catch((innerErr) => {
              onShowError(
                "An error occurred removing a file",
                innerErr,
                notificationId,
              );
            });
        }
      },
    );
  }

  private handleChangeType = (newType: any) => {
    this.nextState.feedbackType = newType;
  };

  private selectBug = () => {
    this.nextState.feedbackType = "bugreport";
  };

  private selectSuggestion = () => {
    this.nextState.feedbackType = "suggestion";
  };

  private selectQuestion = () => {
    this.nextState.feedbackType = "question";
  };

  private handleChangeTopic = (newTopic: any) => {
    this.nextState.feedbackTopic = newTopic;
  };

  private ratio(title: string, issue: IPreviewIssue) {
    const titleL = title.toLowerCase();
    if (issue.keywords.find((keyword) => titleL.indexOf(keyword) !== -1)) {
      return 100;
    } else {
      return partial_ratio(title, issue.title);
    }
  }

  private handleChangeTitle = (newTitle: string) => {
    this.nextState.feedbackTitle = newTitle;
    if (newTitle.length > 2) {
      this.nextState.filteredIssues = this.issues
        .map((iss) => ({
          ratio: this.ratio(newTitle, iss),
          title: iss.title,
          url: iss.url,
          type: iss.type,
        }))
        .filter((iss) => iss.ratio > 90)
        .sort((lhs, rhs) => rhs.ratio - lhs.ratio);
    } else {
      this.nextState.filteredIssues = [];
    }
  };

  private handleChange = (event) => {
    this.nextState.feedbackMessage = event.currentTarget.value;
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<types.IState, null, Redux.Action>,
): IActionProps {
  return {
    onShowActivity: (message: string, id?: string) =>
      util.showActivity(dispatch, message, id),
    onRemoveFeedbackFile: (feedbackFileId: string) =>
      dispatch(removeFeedbackFile(feedbackFileId)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onShowError: (
      message: string,
      details?: string | Error,
      notificationId?: string,
      allowReport?: boolean,
    ) =>
      util.showError(dispatch, message, details, {
        id: notificationId,
        allowReport,
      }),
    onDismissNotification: (id: string) =>
      dispatch(actions.dismissNotification(id)),
    onClearFeedbackFiles: () => dispatch(clearFeedbackFiles()),
    onAddFeedbackFile: (feedbackFile) =>
      dispatch(addFeedbackFile(feedbackFile)),
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    ...state.session.feedback,
    APIKey: state.confidential.account.nexus.APIKey,
    OAuthCredentials: state.confidential.account.nexus.OAuthCredentials,
    newestVersion: state.persistent.nexus.newestVersion,
  };
}

export default withTranslation(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(FeedbackPage) as any,
) as React.ComponentClass<never>;
