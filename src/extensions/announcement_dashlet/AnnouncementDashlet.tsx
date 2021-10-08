import { TFunction } from 'i18next';
import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';

import { matchesGameMode, matchesVersion } from './util';

import Dashlet from '../../controls/Dashlet';
import { Icon, IconButton } from '../../controls/TooltipControls';
import { getApplication } from '../../util/application';
import { ComponentEx, translate } from '../../util/ComponentEx';
import opn from '../../util/opn';
import * as selectors from '../../util/selectors';

import { EmptyPlaceholder, FlexLayout } from '../../controls/api';
import { AnnouncementSeverity, IAnnouncement } from './types';

interface IConnectedProps {
  gameMode: string;
  announcements: IAnnouncement[];
}

type IProps = WithTranslation & IConnectedProps;

class AnnouncementDashlet extends ComponentEx<IProps, {}> {
  private mAppVersion: string;
  constructor(props: IProps) {
    super(props);
    this.mAppVersion = getApplication().version;
  }

  public render(): JSX.Element {
    const { t, announcements, gameMode } = this.props;

    // Filter announcements by gamemode and version.
    const filtered = announcements
      .filter(announce => matchesGameMode(announce, gameMode)
                       && matchesVersion(announce, this.mAppVersion))
      .sort((lhs, rhs) => new Date(rhs.date).getTime()
                        - new Date(lhs.date).getTime());
    return (
      <Dashlet className='dashlet-announcement' title={t('Announcements')}>
        <div className='list-announcements-container'>
          {filtered.length > 0 ? this.renderContent(filtered) : this.renderPlaceholder()}
        </div>
      </Dashlet>
    );
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
  };
}

export default
connect(mapStateToProps)(
    translate(['common'])(
      AnnouncementDashlet));
