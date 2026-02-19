import * as React from "react";
import { Pager } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import * as semver from "semver";
import { ComponentEx, Dashlet, util } from "vortex-api";
import ReactMarkdown from "react-markdown";
import { Changelog } from "./types";

interface IConnectedProps {
  changelogs: Array<Changelog>;
  channel: string;
}

type IProps = IConnectedProps;

interface IIssueListState {
  current: number;
}

class ChangelogDashlet extends ComponentEx<IProps, IIssueListState> {
  private mAppVersion: string;

  constructor(props: IProps) {
    super(props);

    this.mAppVersion = util["getApplication"]().version;

    this.initState({
      current: 0,
    });
  }

  public UNSAFE_componentWillMount() {
    this.nextState.current = Math.max(
      this.props.changelogs.findIndex((changelog) =>
        semver.gte(changelog.version, this.mAppVersion),
      ),
      0,
    );
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.changelogs !== nextProps.changelogs) {
      this.nextState.current = Math.max(
        nextProps.changelogs.findIndex((changelog) =>
          semver.gte(changelog.version, this.mAppVersion),
        ),
        0,
      );
    }
  }

  public render(): JSX.Element {
    const { t, changelogs, channel } = this.props;
    const { current } = this.state;
    return (
      <Dashlet className="dashlet-changelog" title={t("What's New")}>
        {this.renderContent()}
      </Dashlet>
    );
  }

  private renderContent() {
    const { t, changelogs, channel } = this.props;
    const { current } = this.state;

    // filter out prereleases if on stable channel
    const filteredChangelogs = changelogs.filter((changelog) => {
      //if(channel === 'stable')
      //  return changelog.prerelease === !(channel === 'stable');

      // we only want to show changelogs that are same or older than the current version
      const comparisonResult = semver.compare(
        changelog.version,
        this.mAppVersion,
      );

      return comparisonResult === 0 || comparisonResult === -1;

      /*
      if(channel === 'stable') 
        return changelog.prerelease === !(channel === 'stable');
      else
        return true;  // return everything if not stable*/
    });

    return (
      <div className="changelog-container">
        {filteredChangelogs.length === 0 ? (
          <div className="changelog-entry">No changelogs found</div>
        ) : (
          filteredChangelogs.slice(0, 10).map((changelog) => (
            <div className="changelog-entry" key={changelog.version}>
              <h4 className="changelog-title">Version {changelog.version}</h4>
              <ReactMarkdown className="changelog-text">
                {changelog.text}
              </ReactMarkdown>
            </div>
          ))
        )}
      </div>
    );
  }

  private prev = () => {
    this.context.api.events.emit(
      "analytics-track-click-event",
      "Dashboard",
      "Previous Changelog",
    );
    this.nextState.current = Math.max(0, this.state.current - 1);
  };

  private next = () => {
    const { changelogs } = this.props;
    this.context.api.events.emit(
      "analytics-track-click-event",
      "Dashboard",
      "Next Changelog",
    );
    this.nextState.current = Math.min(
      changelogs.length - 1,
      this.state.current + 1,
    );
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    changelogs: state.persistent.changelogs.changelogs,
    channel: state.settings.update.channel,
  };
}

export default connect(mapStateToProps)(
  withTranslation(["changelog-dashlet", "common"])(ChangelogDashlet as any),
) as any;
