import { ActionDropdown } from '../../../controls/api';
import { Table, TBody, TD, TR } from '../../../controls/table/MyTable';
import { IActionDefinition } from '../../../types/api';
import { ComponentEx } from '../../../util/ComponentEx';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { getSafe } from '../../../util/storeHelper';

import { getGame } from '../../gamemode_management/util/getGame';

import { IProfile } from '../types/IProfile';
import { IProfileFeature } from '../types/IProfileFeature';

import TransferIcon from './TransferIcon';

import { nativeImage, remote } from 'electron';
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';

export interface IProps {
  t: TFunction;
  active: boolean;
  available: boolean;
  profile: IProfile;
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

function nop() {
  // nop
}

/**
 * presents profiles and allows creation of new ones
 *
 * @class ProfileView
 * @extends {React.Component<IConnectedProps, {}>}
 */
class ProfileItem extends ComponentEx<IProps, IComponentState> {
  private mUserData: string;
  private mMounted: boolean = false;
  constructor(props: IProps) {
    super(props);
    this.initState({
      hasProfileImage: false,
      counter: 0,
    });
    this.mUserData = remote.app.getPath('userData');
  }

  public componentDidMount() {
    if (this.props.profile === undefined) {
      this.setHasProfileImage(false);
    } else {
      try {
        fs.statAsync(this.imagePath)
          .then(() => this.setHasProfileImage(true))
          .catch(() => this.setHasProfileImage(false));
      } catch (err) {
        this.setHasProfileImage(false);
      }
    }
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
  }

  public render(): JSX.Element {
    const { t, active, available, features, highlightGameId, profile } = this.props;
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

    let logo = '';

    try {
      logo = hasProfileImage || (game === undefined)
        ? this.imagePath
        : path.join(game.extensionPath, game.logo);
    } catch (err) {
      log('warn', 'failed to identify profile logo path', { profile, hasProfileImage });
    }

    const gameName = (game !== undefined)
      ? game.name
      : t('Unknown game {{ gameId }}', { replace: { gameId: profile.gameId } });

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
            style={{ background: `url('file://${logo}?${counter}')` }}
            onClick={this.changeImage}
          />
          <h3 className='profile-name'>{`${gameName} - ${profile.name}`}</h3>
          <Table className='profile-details'>
            <TBody>
              {this.renderFeatureWithValue({
                id: profile.id + 'mods',
                label: t('Mods Enabled'),
                icon: 'mods',
                type: 'number',
                supported: () => true,
                description: t('Number of Mods enabled'),
              }, enabledMods)}
              {this.renderFeatureWithValue({
                id: profile.id + 'id',
                label: t('ID'),
                icon: '',
                type: 'string',
                supported: () => true,
                description: t('Internal ID of this profile'),
              }, profile.id)}

              {features.map(this.renderFeature)}
            </TBody>
          </Table>
        </div>
        <div className='profile-actions'>
          <ActionDropdown
            group='profile-actions'
            orientation='vertical'
            className='menubar'
            staticElements={actions}
            buttonType='both'
            instanceId={profile.id}
          />
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

  private getActions(): IActionDefinition[] {
    const { t, active, available } = this.props;

    const res: IActionDefinition[] = [];
    if (!active && available) {
      res.push({ icon: 'activate', title: t('Enable'), action: this.activate });
    }
    if (available) {
      res.push({ icon: 'edit', title: t('Edit'), action: this.startEditing });
      res.push({ icon: 'clone', title: t('Clone'), action: this.cloneProfile });
    }
    res.push({ icon: 'remove', title: t('Remove'), action: this.removeProfile });
    return res;
  }

  private renderFeature = (feature: IProfileFeature): JSX.Element => {
    const { profile } = this.props;
    const value = getSafe(profile, ['features', feature.id], undefined);
    return this.renderFeatureWithValue(feature, value);
  }

  private renderFeatureWithValue(feature: IProfileFeature, value: any): JSX.Element {
    const { profile } = this.props;
    const id = `icon-profilefeature-${profile.id}-${feature.id}`;
    return (
      <TR key={id}>
        <TD>
          <a className='fake-link' title={feature.description} onClick={nop}>{feature.label}</a>
        </TD>
        <TD>
          {this.renderFeatureValue(feature.type, value)}
        </TD>
      </TR>
    );
  }

  private renderFeatureValue(type: string, value: any) {
    const { t } = this.props;
    if (type === 'boolean') {
      return value === true ? t('yes') : t('no');
    } else {
      return value;
    }
  }

  private changeImage = () => {
    this.context.api.selectFile({ filters: [{ name: 'Image', extensions: ['jpg', 'gif', 'png'] }] })
    .then(file => {
      if (file === undefined) {
        return;
      }
      const img = nativeImage.createFromPath(file);
      try {
        // TODO: could resize here to save some disc space
        return fs.writeFileAsync(this.imagePath, img.toPNG())
          .then(() => {
            this.setHasProfileImage(true);
          });
      } catch (err) {
        log('warn', 'failed to get path for profile image', { profile: this.props.profile });
      }
    });
  }

  private setHasProfileImage(hasImage: boolean) {
    if (this.mMounted) {
        this.nextState.hasProfileImage = hasImage;
        this.nextState.counter++;
    }
  }

  private get imagePath(): string {
    const { profile } = this.props;
    return path.join(
      this.mUserData, profile.gameId, 'profiles', profile.id, 'banner.png');
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
