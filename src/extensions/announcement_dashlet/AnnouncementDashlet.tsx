import { remote } from 'electron';
import * as minimatch from 'minimatch';
import * as React from 'react';
import { connect } from 'react-redux';
import * as semver from 'semver';

import Dashlet from '../../controls/Dashlet';
import { Icon, IconButton } from '../../controls/TooltipControls';
import { ComponentEx, translate } from '../../util/ComponentEx';
import opn from '../../util/opn';
import * as selectors from '../../util/selectors';

import { EmptyPlaceholder, FlexLayout } from '../../controls/api';
import { AnnouncementSeverity, IAnnouncement } from './types';
import { WithTranslation } from 'react-i18next';

interface IConnectedProps {
  gameMode: string;
  announcements: Array<{
    date: string,
    description: string,
    severity: AnnouncementSeverity,
    link?: string,
    gamemode?: string,
    icon?: string,
    version?: string }>;
}

interface IActionProps {
}

type IProps = WithTranslation & IConnectedProps & IActionProps;

class AnnouncementDashlet extends ComponentEx<IProps, {}> {
  private mAppVersion: string;
  constructor(props: IProps) {
    super(props);
  }

  public componentDidMount() {
    this.mAppVersion = remote.app.getVersion();
  }

  public render(): JSX.Element {
    const { t, announcements } = this.props;

    // Filter announcements by gamemode and version.
    const filtered = announcements.filter(announce => this.matchesGameMode(announce)
                                                   && this.matchesVersion(announce));

    return (
      <Dashlet className='dashlet-announcement' title={t('Announcements')}>
        {filtered.length > 0 ? this.renderContent(filtered) : this.renderPlaceholder()}
      </Dashlet>);
  }

  private matchesGameMode(announcement: IAnnouncement): boolean {
    const { gameMode } = this.props;
    if ((gameMode === undefined) && (announcement.gamemode === undefined)) {
      return true;
    }

    return (announcement.gamemode !== undefined)
      ? minimatch(gameMode, announcement.gamemode)
      : true;
  }

  private matchesVersion(announcement: IAnnouncement): boolean {
    if (this.mAppVersion === undefined) {
      // How is this even possible ?
      return false;
    }

    return (announcement.version !== undefined)
      ? semver.satisfies(this.mAppVersion, announcement.version)
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
    if ((sev !== 'information') && (announcement.icon !== undefined)) {
      return (
      <Icon
        className={`announcement-icon-${sev}`}
        key='attention-required'
        name={announcement.icon}
        tooltip={t('Icon')}
      />);
    } else {
      return null;
    }
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

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state) || undefined,
    announcements: state.session.announcements.announcements,
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'])(
      AnnouncementDashlet));
