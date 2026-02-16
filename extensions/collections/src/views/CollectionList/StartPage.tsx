/* eslint-disable */
import { setSortAdded, setSortWorkshop } from '../../actions/settings';
import { initFromProfile } from '../../collectionCreate';
import {
  MAX_COLLECTION_NAME_LENGTH,
  MIN_COLLECTION_NAME_LENGTH,
  MOD_TYPE,
  NAMESPACE,
  NEXUS_BASE_GAMES_URL,
  NEXUS_BASE_URL,
} from "../../constants";
import InfoCache from "../../util/InfoCache";
import { validateName } from "../../util/transformCollection";
import { hasEditPermissions } from "../../util/util";

import CollectionThumbnail from '../CollectionTile';
import CollectionThumbnailRemote from '../CollectionTile/RemoteTile';

import { IRevision } from '@nexusmods/nexus-api';
import i18next from 'i18next';
import * as _ from 'lodash';
import * as React from 'react';
import { Panel, Tab, Tabs } from 'react-bootstrap';
import { Trans } from 'react-i18next';
import { connect } from 'react-redux';
import Select from 'react-select';
import { ComponentEx, EmptyPlaceholder, Icon, IconBar, log, types, util } from 'vortex-api';

const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc3csy4ycVBECvHQDgri37Gqq1gOuTQ7LcpiIaOkGHpDsW4kA/viewform?usp=sf_link';
const BUG_REPORT_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdmDBdGjTQVRa7wRouN4yP6zMvqsxTT86R-DwmQXZq7SWGCSg/viewform?usp=sf_link';

export interface IStartPageProps {
  t: i18next.TFunction;
  game: types.IGameStored;
  installing: types.IMod;
  infoCache: InfoCache;
  profile: types.IProfile;
  activeTab: string;
  localState: { ownCollections: IRevision[] };
  mods: { [modId: string]: types.IMod };
  matchedReferences: { [collectionId: string]: types.IMod[] };
  onCreateCollection: (name: string) => void;
  onInstallCollection: (revision: IRevision) => Promise<void>;
  onClone: (modId: string) => Promise<void>;
  onEdit: (modId: string) => void;
  onUpdate: (modId: string) => Promise<void>;
  onUpload: (modId: string) => void;
  onView: (modId: string) => void;
  onRemove: (modId: string) => void;
  onResume: (modId: string) => void;
  onPause: (modId: string) => void;
  onSetActiveTab: (tabId: string) => void;
}

interface IConnectedProps {
  userInfo: { name: string, userId: number };
  sortAdded: string;
  sortWorkshop: string;
}

interface IActionProps {
  onSetSortAdded: (sorting: string) => void;
  onSetSortWorkshop: (sorting: string) => void;
}

interface ISortItem {
  mod: types.IMod;
  added?: types.IMod;
  revision: IRevision;
}

interface IComponentState {
  createOpen: boolean;
  mousePosition: { x: number, y: number };
  imageTime: number;
  collectionsEx: { added: ISortItem[], workshop: ISortItem[] };
}

function dateCompare(lhs: Date | string, rhs: Date | string): number {
  return (new Date(lhs ?? 0)).getTime() - (new Date(rhs ?? 0)).getTime();
}

const nop = () => null;

// allow any unicode character that is considered a letter or a number and the
// special characters space and minus
const validRE = /^[\p{L}\p{N} -]*$/u;

function validateCollectionName(t: i18next.TFunction, input: string): string {
  if ((input.length < MIN_COLLECTION_NAME_LENGTH) || (input.length > MAX_COLLECTION_NAME_LENGTH)) {
    return t('The name bust be between {{min}}-{{max}} characters long', {
      replace: {
        min: MIN_COLLECTION_NAME_LENGTH,
        max: MAX_COLLECTION_NAME_LENGTH,
      },
    });
  }

  if (input.match(validRE) === null) {
    return t('Invalid characters, only letters, numbers, space and - are allowed.');
  }

  return undefined;
}

interface IAddCardProps {
  t: types.TFunction;
  onClick: () => void;
}

function AddCard(props: IAddCardProps) {
  const { t, onClick } = props;

  const classes = ['collection-add-btn'];

  return (
    <Panel className={classes.join(' ')} bsStyle='default' onClick={onClick}>
      <Panel.Body className='collection-thumbnail-body'>
        <EmptyPlaceholder
          icon='folder-add'
          text={t('Discover more collections')}
        />
      </Panel.Body>
    </Panel>
  );
}

interface ICreateCardProps {
  t: types.TFunction;
  onCreateFromProfile: () => void;
  onCreateEmpty: () => void;
  onCreateQuickCollection: () => void;
  onTrackClick: (namespace: string, eventName: string) => void;
}

function CreateCard(props: ICreateCardProps) {
  const { t, onTrackClick } = props;

  const classes = ['collection-add-btn'];

  const actions = React.useRef<types.IActionDefinition[]>([]);
  
  React.useEffect(() => {
    actions.current = [
      {
        title: 'From Profile',
        icon: 'profile',
        action: () => {
          onTrackClick('Collections', 'From profile');
          props.onCreateFromProfile();
        },
      }, {
        title: 'Empty',
        icon: 'show',
        action: () => {
          onTrackClick('Collections', 'Empty');
          props.onCreateEmpty();
        },
      }, {
        title: 'Quick Collection',
        icon: 'highlight-lab',
        action: () => {
          onTrackClick('Collections', 'Quick Collection');
          props.onCreateQuickCollection();
        },
      },
    ];
  }, [props.onCreateFromProfile, props.onCreateEmpty, props.onCreateQuickCollection]);

  return (
    <Panel className={classes.join(' ')} bsStyle='default'>
      <Panel.Body className='collection-thumbnail-body'>
        <EmptyPlaceholder
          icon='add'
          text={t('Create a collection')}
          fill
        />
        <div className='hover-menu'>
          <div key='primary-buttons' className='hover-content'>
            <IconBar
              className='buttons'
              group='collection-actions'
              staticElements={actions.current}
              collapse={false}
              buttonType='text'
              orientation='vertical'
              clickAnywhere={true}
              t={t}
            />
          </div>
        </div>
      </Panel.Body>
    </Panel>
  );
}

type IProps = IStartPageProps & IConnectedProps & IActionProps;

class StartPage extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      createOpen: false,
      imageTime: Date.now(),
      mousePosition: { x: 0, y: 0 },
      collectionsEx: { added: [], workshop: [] },
    });
  }

  public componentDidMount(): void {
    const collectionsNow = Object.values(this.props.mods).filter(mod => mod.type === MOD_TYPE);
    this.updateSorted(collectionsNow, this.props.sortAdded, this.props.sortWorkshop, false)
      .then(() =>
        this.updateSorted(collectionsNow, this.props.sortAdded, this.props.sortWorkshop, false))
      .catch(err => {
        log('error', 'failed to update list of collections', {
          error: err.message,
        });
      });
  }

  public componentDidUpdate(prevProps: IProps, prevState: Readonly<IComponentState>): void {
    const collectionsPrev = Object.values(prevProps.mods).filter(mod => mod.type === MOD_TYPE);
    const collectionsNow = Object.values(this.props.mods).filter(mod => mod.type === MOD_TYPE);

    if (!_.isEqual(collectionsPrev, collectionsNow)
        || (prevProps.sortAdded !== this.props.sortAdded)
        || (prevProps.sortWorkshop !== this.props.sortWorkshop)
        || (prevProps.localState.ownCollections !== this.props.localState.ownCollections)) {
      this.updateSorted(collectionsNow, this.props.sortAdded, this.props.sortWorkshop, true);
    }
  }

  public render(): JSX.Element {
    const { t, activeTab, installing, profile, matchedReferences, mods,
      onClone, onEdit, onPause, onInstallCollection, onRemove,
      onResume, onUpdate, onUpload, onView, sortAdded, sortWorkshop } = this.props;
    const { imageTime, collectionsEx } = this.state;

    const { added, workshop } = collectionsEx;

    return (
      <Tabs id='collection-start-page' activeKey={activeTab} onSelect={this.setActiveTab}>
        <Tab
          tabClassName='collection-tab'
          eventKey='active-collections'
          title={<><Icon name='add'/>{t('Added Collections')}</>}
        >
          <Panel>
            <Panel.Heading>
              <Panel.Title>
                {t('View and manage collections created by other users.')}
              </Panel.Title>
              <div className='flex-fill' />
              <div className='collection-sort-container'>
                {t('Sort by:')}
                <Select
                  className='select-compact'
                  options={[
                    { value: 'alphabetical', label: t('Name A-Z') },
                    { value: 'datedownloaded', label: t('Date downloaded') },
                    { value: 'recentlyupdated', label: t('Recently updated') },
                  ]}
                  value={sortAdded}
                  onChange={this.setSortAdded}
                  clearable={false}
                  autosize={false}
                  searchable={false}
                />
              </div>
            </Panel.Heading>
            <Panel.Body>
              <div className='collection-list'>
                <AddCard t={t} onClick={this.openCollections} />
                {added.map(mod =>
                  <CollectionThumbnail
                    key={mod.mod.id}
                    t={t}
                    gameId={profile.gameId}
                    imageTime={imageTime}
                    installing={installing}
                    mods={mods}
                    incomplete={matchedReferences[mod.mod.id]?.includes?.(null)}
                    collection={mod.mod}
                    infoCache={this.props.infoCache}
                    onView={onView}
                    onRemove={onRemove}
                    onResume={onResume}
                    onPause={onPause}
                    onUpdate={onUpdate}
                    details={true}
                  />)}
              </div>
            </Panel.Body>
          </Panel>
        </Tab>
        <Tab
          tabClassName='collection-tab'
          eventKey='collection-workshop'
          title={<><Icon name='highlight-tool' />{t('Workshop')}</>}
        >
          <Panel>
            <Panel.Heading>
              <Panel.Title>
                <Trans ns={NAMESPACE} i18nKey='collection-own-page'>
                  Build your own collections and share them with the Nexus Mods community.
                  You can view all your uploaded collections&nbsp;<a
                    onClick={this.openMyCollectionsPage}
                    className='my-collections-page-link'
                    title={t('Open My Collections Page')}
                  >
                    here.
                  </a>
                </Trans>
              </Panel.Title>
              <div className='flex-fill' />
              <div className='collection-sort-container'>
                {t('Sort by:')}
                <Select
                  className='select-compact'
                  options={[
                    { value: 'alphabetical', label: t('Name A-Z') },
                    { value: 'datecreated', label: t('Date created') },
                    { value: 'recentlyupdated', label: t('Recently updated') },
                  ]}
                  value={sortWorkshop}
                  onChange={this.setSortWorkshop}
                  clearable={false}
                  autosize={false}
                  searchable={false}
                />
              </div>
            </Panel.Heading>
            <Panel.Body>
              <div className='collection-list'>
                <CreateCard
                  t={t}
                  onCreateFromProfile={this.fromProfile}
                  onCreateQuickCollection={this.quickCollection}
                  onCreateEmpty={this.fromEmpty}
                  onTrackClick={this.trackEvent}
                />
                {workshop.map(mod => (mod.mod !== undefined)
                  ? (
                    <CollectionThumbnail
                      t={t}
                      key={mod.mod.id}
                      gameId={profile.gameId}
                      collection={mod.mod}
                      infoCache={this.props.infoCache}
                      imageTime={imageTime}
                      mods={mods}
                      incomplete={(mod.mod === undefined)
                        || matchedReferences[mod.mod.id]?.includes?.(null)}
                      onEdit={onEdit}
                      onRemove={onRemove}
                      onUpload={onUpload}
                      details={true}
                    />
                  ) : (
                    <CollectionThumbnailRemote
                      t={t}
                      key={mod.revision.id}
                      revision={mod.revision}
                      added={mod.added}
                      incomplete={(mod.added === undefined)
                        || matchedReferences[mod.added.id]?.includes?.(null)}
                      onInstallCollection={onInstallCollection}
                      onCloneCollection={onClone}
                      onResumeCollection={onResume}
                    />
                  ))}
              </div>
            </Panel.Body>
          </Panel>
        </Tab>
      </Tabs>
    );
  }

  private name(input: ISortItem): string {
    return (input.mod !== undefined)
      ? util.renderModName(input.mod)
      : (input.revision?.collection?.name ?? '');
  }
  
  private sorter(sorting: string): (lhs: ISortItem, rhs: ISortItem) => number {
    const alphabetical = (lhs: ISortItem, rhs: ISortItem) =>
      this.name(lhs).localeCompare(this.name(rhs));

    return {
      alphabetical,
      datedownloaded: (lhs: ISortItem, rhs: ISortItem) =>
        // we install collections immediately and remove the archive, so this is the best
        // approximation but also should be 100% correct
        dateCompare(rhs.mod?.attributes?.installTime, lhs.mod?.attributes?.installTime),
      datecreated: (lhs: ISortItem, rhs: ISortItem) =>
        dateCompare(rhs.mod?.attributes?.installTime ?? rhs.revision?.createdAt
                  , lhs.mod?.attributes?.installTime ?? lhs.revision?.createdAt),
      recentlyupdated: (lhs: ISortItem, rhs: ISortItem) =>
        dateCompare(rhs.revision?.updatedAt ?? rhs.mod.attributes?.installTime,
                    lhs.revision?.updatedAt ?? lhs.mod.attributes?.installTime),
    }[sorting] ?? alphabetical;
  }

  private updateSorted(collections: types.IMod[],
                       sortAdded: string,
                       sortWorkshop: string,
                       allowMetaUpdate: boolean)
                       : Promise<void> {
    return Promise.all(collections.map(async mod => {
      const { revisionId, collectionSlug, revisionNumber } = mod.attributes ?? {};
      const revision = revisionNumber !== undefined
        ? await this.props.infoCache.getRevisionInfo(revisionId, collectionSlug, revisionNumber, allowMetaUpdate ? 'allow' : 'avoid')
        : undefined;
      return { mod, revision };
    }))
      .then((result: ISortItem[]) => {
        let { foreign, own }: { foreign: ISortItem[], own: ISortItem[] } =
          result.reduce((prev, mod) => {
            if (util.getSafe(mod.mod.attributes, ['editable'], false)) {
              prev.own.push(mod);
            } else {
              prev.foreign.push(mod);
            }
            return prev;
          }, { foreign: [], own: [] });

        const installed = new Set(own.map(res => res.mod.attributes?.['collectionSlug']));

      const userId = this.props.userInfo?.userId;
      own.push(
        ...this.props.localState.ownCollections
          .filter((coll) => !installed.has(coll.collection?.slug))
          .filter((coll) => {
            const collUserId = coll.collection?.user?.memberId;
            if (collUserId !== undefined && collUserId === userId) {
              return true;
            }
            return hasEditPermissions(coll.collection?.permissions);
          })
          .map((coll) => ({
            mod: undefined,
            added: foreign.find(iter =>
              iter.revision?.collection?.slug === coll.collection?.slug)?.mod,
            revision: coll,
          })));

        foreign = foreign.sort(this.sorter(sortAdded));
        own = own.sort(this.sorter(sortWorkshop));
        this.nextState.collectionsEx = { added: foreign, workshop: own };
      });
  }

  private setSortAdded = (value: { value: string, label: string }) => {
    if (!!value) {
      this.props.onSetSortAdded(value.value);
    }
  }

  private setSortWorkshop = (value: { value: string, label: string }) => {
    if (!!value) {
      this.props.onSetSortWorkshop(value.value);
    }
  }

  private setActiveTab = (tabId: any) => {
    this.props.onSetActiveTab(tabId);
    this.context.api.events.emit(
      'analytics-track-navigation', `collections/${tabId}`,
    );
  }

  private openCollections = () => {
    const { game } = this.props;
    this.context.api.events.emit('analytics-track-click-event', 'Collections', 'Discover more');
    util.opn(`${NEXUS_BASE_GAMES_URL}/${(util as any).nexusGameId(game)}/collections`).catch(() => null);
  }

  private openMyCollectionsPage = () => {
    this.context.api.events.emit('analytics-track-click-event',
                                 'Collections', 'Open My Collections');
    util.opn(`${NEXUS_BASE_URL}/my-collections`).catch(() => null);
  }

  private trackEvent = (namespace: string, eventName: string) => {
    this.context.api.events.emit('analytics-track-click-event', namespace, eventName);
  }

  private openFeedback = () => {
    util.opn(FEEDBACK_URL).catch(() => null);
  }

  private openBugReport = () => {
    util.opn(BUG_REPORT_URL).catch(() => null);
  }

  private quickCollection = async () => {
    try {
      await initFromProfile(this.context.api);
      this.refreshImages();
    } catch (err) {
      if (!(err instanceof util.UserCanceled)) {
        this.context.api.showErrorNotification('Failed to create quick collection', err);
      }
    }
  }

  private fromProfile = async () => {
    const { profile } = this.props;

    try {
      // initFromProfile will automatically query for the name
      await initFromProfile(this.context.api, profile.id);
      this.refreshImages();
    } catch (err) {
      if (!(err instanceof util.UserCanceled)) {
        this.context.api.showErrorNotification('Failed to init collection', err);
      }
    }
  }

  private fromEmpty = async () => {
    const { t, onCreateCollection } = this.props;

    try {
      const result = await this.context.api.showDialog('question', 'New empty Collection', {
        text: 'Create an empty collection which you can manually add mods to.',
        input: [{ id: 'name', label: 'Collection Name', type: 'text' }],
        condition: content => validateName(t, content),
      }, [
        { label: 'Cancel' },
        { label: 'Create', default: true },
      ]);

      if (result.action === 'Create') {
        await onCreateCollection(result.input['name']);
        this.refreshImages();
      }
    } catch (err) {
      this.context.api.showErrorNotification('Failed to init collection', err);
    }
  }

  private refreshImages() {
    this.nextState.imageTime = Date.now();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    userInfo: state.persistent['nexus']?.userInfo,
    sortAdded: state.settings.collections.sortAdded ?? 'datedownloaded',
    sortWorkshop: state.settings.collections.sortWorkshop ?? 'recentlyupdated',
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetSortAdded: (sorting: string) => dispatch(setSortAdded(sorting)),
    onSetSortWorkshop: (sorting: string) => dispatch(setSortWorkshop(sorting)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  StartPage) as any as React.ComponentClass<IStartPageProps>;
