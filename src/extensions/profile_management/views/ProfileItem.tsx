import Icon from '../../../controls/Icon';
import { Table, TD, TR } from '../../../controls/table/MyTable';
import { Icon as TooltipIcon, IconButton } from '../../../controls/TooltipControls';
import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { getGame } from '../../gamemode_management/index';

import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import TransferIcon from './TransferIcon';

import { nativeImage, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { MenuItem, SplitButton } from 'react-bootstrap';

interface IActionEntry {
  id: string;
  icon: string;
  text: string;
  action: () => void;
}

export interface IProps {
  t: I18next.TranslationFunction;
  active: boolean;
  available: boolean;
  profile: IProfile;
  gameName: string;
  features: IProfileFeature[];
  highlightGameId: string;

  onActivate: (profileId: string) => void;
  onClone: (profileId: string) => void;
  onRemove: (profileId: string) => void;
  onStartEditing: (id: string) => void;
  onSetHighlightGameId: (gameId: string) => void;
}

interface IComponentState {
  hasProfileImage: boolean;
  counter: number;
}

/**
 * presents profiles and allows creation of new ones
 *
 * @class ProfileView
 * @extends {React.Component<IConnectedProps, {}>}
 */
class ProfileItem extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      hasProfileImage: false,
      counter: 0,
    });
  }

  public componentWillMount() {
    fs.statAsync(this.imagePath)
    .then(() => this.nextState.hasProfileImage = true)
    .catch(() => this.nextState.hasProfileImage = false);
  }

  public render(): JSX.Element {
    const { t, active, available, features, gameName, highlightGameId, profile } = this.props;
    const { counter, hasProfileImage } = this.state;

    const modState = getSafe(profile, ['modState'], {});

    const enabledMods = Object.keys(modState).reduce(
      (prev: number, key: string): number => {
        return modState[key].enabled ? prev + 1 : prev;
    }, 0);

    // TODO: not using ListGroupItem because it puts the content into
    //       <p>-tags so it doesn't support 'complex' content

    const classes = ['profile-item'];
    if (((highlightGameId !== undefined) && (highlightGameId !== profile.gameId))
        || !available) {
      classes.push('disabled');
    } else if (active) {
      classes.push('active');
    }

    const game = getGame(profile.gameId);

    let logo = hasProfileImage
      ? this.imagePath
      : path.join(game.extensionPath, game.logo);

    if (process.platform === 'win32') {
      logo = logo.replace(/\\/g, '/');
    }

    const imageClass = ['profile-image'];
    if (!hasProfileImage) {
      // game images have a different aspect ratio so offset a bit. Makes
      // it more likely to show an "interesting" part of the image
      imageClass.push('offset');
    }
    const actions = this.getActions();

    return (
      <div className={classes.join(' ')} style={{ display: 'flex' }}>
        <div style={{ flex: '1 1 0' }}>
          <div
            className={imageClass.join(' ')}
            style={{ background: `url(file://${logo}?${counter})` }}
            onClick={this.changeImage}
          />
          <h3 className='profile-name'>{`${gameName} - ${profile.name}`}</h3>
          <Table className='profile-details'>
            <TR><TD><TooltipIcon
              id={profile.id}
              name='mods'
              tooltip={t('Number of Mods enabled')}
            /></TD><TD>{enabledMods}</TD></TR>

            {features.map(this.renderFeature)}
          </Table>
        </div>
        <div className='profile-actions'>
          <SplitButton
            id={`profile-${profile.id}-actions`}
            title={(
              <div>
                <Icon name={actions[0].icon} />
                {actions[0].text}
              </div>
            )}
            onClick={actions[0].action}
          >
            {this.renderActions(actions.slice(1))}
          </SplitButton>
          <TransferIcon
            t={t}
            disabled={!available}
            profile={profile}
            onSetHighlightGameId={this.props.onSetHighlightGameId}
          />
        </div>
      </div>
    );
  }

  private getActions(): IActionEntry[] {
    const { t, active, available, profile } = this.props;

    const res = [];
    if (!active && available) {
      res.push({ id: 'enable', icon: 'activate', text: t('Enable'), action: this.activate });
    }
    if (available) {
      res.push({ id: 'edit', icon: 'edit', text: t('Edit'), action: this.startEditing });
      res.push({ id: 'clone', icon: 'clone', text: t('Clone'), action: this.cloneProfile });
    }
    res.push({ id: 'remove', icon: 'remove', text: t('Remove'), action: this.removeProfile });
    return res;
  }

  private renderActions(actions: IActionEntry[]): JSX.Element[] {
    const { t, active, available, profile } = this.props;
    return actions.map(action => (
      <MenuItem key={action.id} onClick={action.action} >
        <Icon name={action.icon} />
        {action.text}
      </MenuItem>
    ));
  }

  private renderFeature = (feature: IProfileFeature): JSX.Element => {
    const { t, profile } = this.props;
    const id = `icon-profilefeature-${profile.id}-${feature.id}`;
    return (
      <TR key={id}>
        <TD>
        <TooltipIcon
          id={id}
          className='icon-profile-feature'
          tooltip={t(feature.description)}
          name={feature.icon}
        />
        </TD>
        <TD>{
          this.renderFeatureValue(feature.type,
                                  getSafe(profile, ['features', feature.id], undefined))
        }</TD>
      </TR>
    );
  }

  private renderFeatureValue(type: string, value: any) {
    const { t } = this.props;
    if (type === 'boolean') {
      return value === true ? t('yes') : t('no');
    }
  }

  private changeImage = () => {
    this.context.api.selectFile({ filters: [{ name: 'Image', extensions: ['jpg', 'gif', 'png'] }] })
    .then(file => {
      if (file === undefined) {
        return;
      }
      const img = nativeImage.createFromPath(file);
      // TODO: could resize here to save some disc space
      return fs.writeFileAsync(this.imagePath, img.toPNG())
       .then(() => {
         this.nextState.hasProfileImage = true;
         this.nextState.counter++;
       });
    });
  }

  private get imagePath(): string {
    const { profile } = this.props;
    return path.join(
      remote.app.getPath('userData'), profile.gameId, 'profiles', profile.id, 'banner.png');
  }

  private cloneProfile = () => {
    const { onClone, profile } = this.props;
    onClone(profile.id);
  }

  private removeProfile = () => {
    const { onRemove, profile } = this.props;
    onRemove(profile.id);
  }

  private activate = () => {
    const { onActivate, profile } = this.props;
    onActivate(profile.id);
  }

  private startEditing = () => {
    const { onStartEditing, profile } = this.props;
    onStartEditing(profile.id);
  }
}

export default ProfileItem as React.ComponentClass<IProps>;
