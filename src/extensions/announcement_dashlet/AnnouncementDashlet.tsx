import { remote } from 'electron';
import { TFunction } from 'i18next';
import minimatch from 'minimatch';
import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as semver from 'semver';

import Dashlet from '../../controls/Dashlet';
import { Icon, IconButton } from '../../controls/TooltipControls';
import { ComponentEx, translate } from '../../util/ComponentEx';
import opn from '../../util/opn';
import * as selectors from '../../util/selectors';

import { setSuppressSurvey } from './actions';

import { EmptyPlaceholder, FlexLayout } from '../../controls/api';
import { AnnouncementSeverity, IAnnouncement, ISurveyInstance } from './types';

import { getSafe } from '../../util/storeHelper';

interface IConnectedProps {
  gameMode: string;
  announcements: IAnnouncement[];
  surveys: ISurveyInstance[];
  suppressed: { [id: string]: boolean };
}

interface IActionProps {
  OnSuppressSurvey: (id: string, suppress: boolean) => void;
}

type IProps = WithTranslation & IConnectedProps & IActionProps;

class AnnouncementDashlet extends ComponentEx<IProps, {}> {
  private mAppVersion: string;
  constructor(props: IProps) {
    super(props);
    this.mAppVersion = remote.app.getVersion();
  }

  public componentDidMount() {
    const { t, surveys, suppressed, OnSuppressSurvey } = this.props;
    const now = new Date().getTime();
    const suppressedIds = Object.keys(suppressed);
    const isOutdated = (survey: ISurveyInstance) => {
      const surveyCutoffDateMS = new Date(survey.endDate).getTime();
      return surveyCutoffDateMS <= now;
    };

    const filtered = surveys.filter(survey => {
      const isSuppressed = (suppressedIds.includes(survey.id) && (suppressed[survey.id] === true));
      return !isSuppressed
          && !isOutdated(survey)
          && this.matchesGameMode(survey, (survey?.gamemode === undefined))
          && this.matchesVersion(survey);
    });

    if (filtered.length > 0) {
      this.context.api.sendNotification({
        id: 'survey-notification',
        type: 'info',
        message: t('We could use your opinion on something...'),
        noDismiss: true,
        actions: [
          {
            title: 'Go to Survey',
            action: (dismiss) => {
              const survey = filtered[0];
              opn(survey.link)
                .then(() => OnSuppressSurvey(survey.id, true))
                .catch(() => null);
              dismiss();
            },
          },
          {
            title: 'No thanks',
            action: (dismiss) => {
              const survey = filtered[0];
              OnSuppressSurvey(survey.id, true);
              dismiss();
            },
          },
        ],
      });
    }
  }

  public render(): JSX.Element {
    const { t, announcements } = this.props;

    // Filter announcements by gamemode and version.
    const filtered = announcements.filter(announce => this.matchesGameMode(announce)
                                                   && this.matchesVersion(announce));

    return (
      <Dashlet className='dashlet-announcement' title={t('Announcements')}>
        <div className='list-announcements-container'>
          {filtered.length > 0 ? this.renderContent(filtered) : this.renderPlaceholder()}
        </div>
      </Dashlet>
    );
  }

  private matchesGameMode<T>(entry: T, forceMatch: boolean = false): boolean {
    const { gameMode } = this.props;
    const entryGameMode = getSafe(entry, ['gamemode'], undefined);
    if ((gameMode === undefined)
      && ((entryGameMode === undefined) || (entryGameMode === '*'))) {
      return true;
    }

    return ((entryGameMode !== undefined) && (gameMode !== undefined))
    // Only compare gameModes when the entry is game specific and
    //  we have an active game mode. We use forceMatch at this point as
    //  we don't want to display announcements if the predicate fails, but
    //  we _do_ want to display surveys, so this allows us to keep the same
    //  predicate for both use cases. (bit hacky I admit..)
      ? minimatch(gameMode, entryGameMode)
      : forceMatch;
  }

  private matchesVersion<T>(entry: T): boolean {
    if (this.mAppVersion === undefined) {
      // TODO: should never happen. This check was added when mAppVersion was assigned during
      // componentDidMount and this got called before that. Now it's only here because
      // I'm too scared to remove it.
      return false;
    }

    const entryVersion = getSafe(entry, ['version'], undefined);
    return (entryVersion !== undefined)
      ? semver.satisfies(this.mAppVersion, entryVersion)
      : true;
  }

  private renderPlaceholder(): JSX.Element {
    const { t } = this.props;
    return (
      <EmptyPlaceholder
        icon='announcements'
        text={t('No Announcements')}
        subtext={t('No news is good news!')}
      />
    );
  }

  private openLink = (evt) => {
    evt.preventDefault();
    const link = evt.currentTarget.getAttribute('data-link');
    opn(link).catch(() => null);
  }

  private renderIcon(announcement: IAnnouncement): JSX.Element {
    const { t } = this.props;
    const sev = announcement.severity !== undefined ? announcement.severity : 'information';
    const icon = this.severityToIcon(sev);
    if (icon !== undefined) {
      return (
        <Icon
          className={`announcement-icon announcement-icon-${sev}`}
          name={icon}
          tooltip={this.severityToTooltip(t, sev)}
        />
      );
    } else {
      return null;
    }
  }

  private severityToIcon(severity: AnnouncementSeverity): string {
    switch (severity) {
      case 'warning': return 'feedback-warning';
      case 'critical': return 'feedback-warning';
    }
    return undefined;
  }

  private severityToTooltip(t: TFunction, severity: AnnouncementSeverity): string {
    switch (severity) {
      case 'warning': return t('Warning');
      case 'critical': return t('Critical');
      case 'information': return t('Information');
    }
    return '';
  }

  private generateExtraPanel(announcement: IAnnouncement): JSX.Element {
    const { t } = this.props;
    const generateLinkButton = (): JSX.Element => {
      return (
        <IconButton
          className='announcement-open-link-icon'
          data-link={announcement.link}
          icon='about'
          tooltip={t('View Issue')}
          onClick={this.openLink}
        />
      );
    };

    const generateDate = (): JSX.Element => (
      <div>
        {new Date(announcement.date).toLocaleDateString(this.context.api.locale())}
      </div>
    );

    return (
      <FlexLayout type='row' className='announcement-extras'>
        {generateDate()}
        {announcement.link !== undefined ? generateLinkButton() : null}
      </FlexLayout>
    );
  }

  private generateDescription = (announcement: IAnnouncement): JSX.Element => {
    const { t } = this.props;
    return (
      <FlexLayout type='row' className='announcement-description'>
        {this.renderIcon(announcement)}
        <p>{announcement.description}</p>
      </FlexLayout>
    );
  }

  private renderContent(filtered: IAnnouncement[]) {
    const renderElement = (announcement: IAnnouncement, id: number): JSX.Element => {
      return (
        <li key={id} className='announcement-list-item'>
            <FlexLayout type='column'>
              {this.generateDescription(announcement)}
              {this.generateExtraPanel(announcement)}
            </FlexLayout>
        </li>);
    };

    return (
      <ul className='list-announcements'>
        {filtered.map((announcement, id) => renderElement(announcement, id))}
      </ul>
    );
  }
}

const empty = {};
function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state) || undefined,
    announcements: state.session.announcements.announcements,
    surveys: getSafe(state, ['session', 'surveys', 'available'], []),
    suppressed: getSafe(state, ['persistent', 'surveys', 'suppressed'], empty),
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
    OnSuppressSurvey: (id: string, suppress: boolean) =>
      dispatch(setSuppressSurvey(id, suppress)),
  };
}

export default
connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'])(
      AnnouncementDashlet));
