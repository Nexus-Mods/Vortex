import { ICollection, ICollectionSearchOptions, CollectionSortField, SortDirection } from '@nexusmods/nexus-api';
import numeral from 'numeral';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import MainPage from '../../../views/MainPage';
import Tailwind from '../../../tailwind';
import { activeGameId } from '../../../util/selectors';
import { IState } from '../../../types/IState';
import { IExtensionApi } from '../../../types/IExtensionContext';
import opn from '../../../util/opn';
import { getGame } from '../../gamemode_management/util/getGame';
import { nexusGameId } from '../../nexus_integration/util/convertGameId';
import { CollectionsDownloadClickedEvent } from '../../analytics/mixpanel/MixpanelEvents';

interface IBrowseNexusPageProps {
  api: IExtensionApi;
}

interface ISortOption {
  field: CollectionSortField;
  direction: SortDirection;
  label: string;
}

const SORT_OPTIONS: ISortOption[] = [
  { field: 'createdAt', direction: 'DESC', label: 'Recently Listed' },
  { field: 'endorsements', direction: 'DESC', label: 'Most Endorsed' },
  { field: 'recentRating', direction: 'DESC', label: 'Highest Rated' },
  { field: 'downloads', direction: 'DESC', label: 'Most Downloaded' },
];

function BrowseNexusPage(props: IBrowseNexusPageProps) {
  const { api } = props;
  const { t } = useTranslation(['collection', 'common']);
  const gameId = useSelector((state: IState) => activeGameId(state));

  const [collections, setCollections] = React.useState<ICollection[]>([]);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [allCollectionsTotal, setAllCollectionsTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [sortBy, setSortBy] = React.useState<ISortOption>(SORT_OPTIONS[1]); // Default to "Most Endorsed"
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [activeSearch, setActiveSearch] = React.useState<string>(''); // The search term actually being used
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageInput, setPageInput] = React.useState<string>('1');
  const [selectedTab, setSelectedTab] = React.useState<string>('collections');
  const itemsPerPage = 20;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddCollection = (collection: ICollection) => {
    const revisionNumber = (collection as any).latestPublishedRevision?.revisionNumber || 'latest';
    // Use the game domain name from the collection data (already converted)
    const nxmUrl = `nxm://${collection.game.domainName}/collections/${collection.slug}/revisions/${revisionNumber}`;


    // Track the download click event
    api.events.emit('analytics-track-mixpanel-event',
      new CollectionsDownloadClickedEvent(collection.slug, collection.game.id));

    // Use the Vortex API to handle the NXM link
    api.events.emit('start-download', [nxmUrl], {}, undefined,
      (err: Error) => {
        if (err && !(err instanceof (api.ext as any).UserCanceled)) {
          api.showErrorNotification('Failed to add collection', err);
        }
      }, undefined, { allowInstall: 'force' });
  };

  const handleViewOnNexus = (collection: ICollection) => {
    const nexusUrl = `https://www.nexusmods.com/games/${collection.game.domainName}/collections/${collection.slug}`;
    opn(nexusUrl).catch(() => undefined);
  };

  React.useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const options: ICollectionSearchOptions = {
      gameId: nexusGameId(getGame(gameId), gameId),
      count: 20,
      offset: (currentPage - 1) * itemsPerPage,
      sort: {
        field: sortBy.field,
        direction: sortBy.direction,
      },
      search: activeSearch || undefined,
    };

    // Fetch collections using the new search API with sorting and search
    Promise.resolve(api.ext.nexusSearchCollections(options))
      .then((result: { nodes: ICollection[]; totalCount: number }) => {
        setCollections(result.nodes || []);
        setTotalCount(result.totalCount || 0);
        // Store unfiltered total when no search is active
        if (!activeSearch) {
          setAllCollectionsTotal(result.totalCount || 0);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err);
        setLoading(false);
      });
  }, [gameId, sortBy, activeSearch, currentPage, api]);

  React.useEffect(() => {
    setCurrentPage(1);
    setPageInput('1');
  }, [sortBy, activeSearch]);

  const formatFileSize = (bytes: string): string => {
    const size = parseInt(bytes, 10);
    if (isNaN(size)) return '0 MB';
    const mb = size / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
    }
  };

  const handlePageClick = (page: number) => {
    setCurrentPage(page);
    setPageInput(page.toString());
  };

  const handleGoToPage = () => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGoToPage();
    }
  };

  if (!gameId) {
    return (
      <MainPage id='browse-collections-page'>
        <MainPage.Body>
          <div className="tw:p-5 tw:text-center">
            <p>{t('collection:browse.selectGame')}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  if (loading) {
    return (
      <MainPage id='browse-collections-page'>
        <MainPage.Body>
          <div className="tw:p-5 tw:text-center">
            <p>{t('collection:browse.loading')}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  if (error) {
    return (
      <MainPage id='browse-collections-page'>
        <MainPage.Body>
          <div className="tw:p-5 tw:text-red-600">
            <p><strong>{t('collection:browse.error')}</strong></p>
            <p>{error.message}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  if (collections.length === 0) {
    return (
      <MainPage id='browse-collections-page'>
        <MainPage.Body>
          <div className="tw:p-5 tw:text-center">
            <p>{t('collection:browse.noCollections')}</p>
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  return (
    <MainPage id='browse-collections-page'>
      <MainPage.Body style={{ overflowY: 'auto' }}>
        <div className="tw:h-full tw:p-5">

          <Tailwind.TabProvider
            tab={selectedTab}
            tabListId="browse-nexus-tabs"
            onSetSelectedTab={setSelectedTab}
          >
            <Tailwind.TabBar className="tw:mb-5">
              <Tailwind.TabButton
                name={t('collection:browse.tabs.collections')}
                count={allCollectionsTotal}
              />
              <Tailwind.TabButton name={t('collection:browse.tabs.mods')} />
            </Tailwind.TabBar>

            <Tailwind.TabPanel name={t('collection:browse.tabs.collections')}>
              {/* Search Bar */}
          <div className="tw:flex tw:gap-2.5 tw:mb-4 tw:items-start">

            <Tailwind.Input
              type="text"
              onChange={(e) => setSearchQuery(e.target.value)}
              value={searchQuery}
              placeholder={t('collection:browse.searchPlaceholder')}
              onKeyDown={handleKeyDown}
              className='tw:max-w-64'
            />

            <Tailwind.Button
              buttonType="secondary"
              size="md"
              filled="strong"
              onClick={handleSearch}
            >
              {t('common:actions.search')}
            </Tailwind.Button>
          </div>

          {/* Results count and sort */}
          <div className="tw:flex tw:justify-between tw:items-center tw:mb-5">
            <Tailwind.Typography typographyType="body-md" appearance="moderate" isTranslucent>
              {t('collection:browse.resultsCount', { total: numeral(totalCount).format('0,0') })}
            </Tailwind.Typography>


            <Tailwind.Select
              id="sort-select"
              label={t('collection:browse.sortBy')}
              hideLabel={true}
              value={SORT_OPTIONS.indexOf(sortBy)}
              onChange={(e) => setSortBy(SORT_OPTIONS[parseInt(e.target.value, 10)])}
              className="tw:flex tw:items-center tw:gap-2.5 tw:max-w-64"
            >
              {SORT_OPTIONS.map((option, index) => (
                <option key={option.field} value={index}>
                  {option.label}
                </option>
              ))}
            </Tailwind.Select>
          </div>

          {/* Collection Tiles */}
          <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(465px,1fr))] tw:gap-4">
            {collections.map((collection) => {
              const tileImage = (collection as any).tileImage?.thumbnailUrl || 'https://placehold.co/166x207/1f1f1f/666?text=No+Image';
              const latestRevision = (collection as any).latestPublishedRevision;
              const tags: string[] = [];

              // Extract tags from collection - ensure all tags are strings
              if ((collection as any).category?.name) {
                tags.push((collection as any).category.name);
              }
              if (latestRevision?.adultContent) {
                tags.push('Adult');
              }

              return (
                <Tailwind.CollectionTile
                  key={collection.id}
                  id={collection.id.toString()}
                  title={collection.name}
                  author={{
                    name: collection.user?.name || 'Unknown',
                    avatar: collection.user?.avatar,
                  }}
                  coverImage={tileImage}
                  tags={tags}
                  stats={{
                    modCount: latestRevision?.modCount || 0,
                    size: latestRevision?.totalSize || 0,
                    endorsements: collection.endorsements || 0,
                  }}
                  description={(collection as any).summary || 'No description available.'}
                  version={latestRevision?.revisionNumber?.toString()}
                  onAddCollection={() => handleAddCollection(collection)}
                  onViewPage={() => handleViewOnNexus(collection)}
                  className="tw:max-w-none"
                />
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="tw:flex tw:items-center tw:justify-start tw:gap-2.5 tw:mt-8 tw:pb-5">
              {/* Previous Button */}
              <Tailwind.Button
                buttonType="tertiary"
                size="md"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                leftIconPath="mdiChevronLeft"
                className=""
              />

              {/* Page Numbers */}
              <div className="tw:flex tw:gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    // Show first page, last page, current page, and 2 pages on each side of current
                    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2) {
                      return true;
                    }
                    return false;
                  })
                  .map((page, idx, array) => {
                    // Add ellipsis if there's a gap
                    const prevPage = array[idx - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && (
                          <span className="tw:px-1 tw:py-2 tw:text-gray-500">...</span>
                        )}
                        <Tailwind.Button
                          buttonType="tertiary"
                          size="md"
                          filled={page === currentPage ? 'weak' : undefined}
                          onClick={() => handlePageClick(page)}
                          className=""
                        >
                          {page.toString()}
                        </Tailwind.Button>
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Next Button */}
              <Tailwind.Button
                buttonType="tertiary"
                size="md"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                leftIconPath="mdiChevronRight"
                className=""
              />

              {/* Direct Page Input */}
              <div className="tw:flex tw:items-center tw:gap-1 tw:ml-5">
                <Tailwind.Typography typographyType="body-md" appearance="subdued">
                  {t('collection:pagination.goTo')}
                </Tailwind.Typography>
                <Tailwind.Input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={handlePageInputKeyDown}
                  className="tw:min-w-10 tw:text-center"
                  id="page-input"
                  label={t('collection:pagination.pageNumber')}
                  hideLabel={true}
                  min={1}
                  max={totalPages}
                />
                <Tailwind.Button
                  buttonType="secondary"
                  size="md"
                  filled="weak"
                  onClick={handleGoToPage}
                >
                  {t('collection:pagination.go')}
                </Tailwind.Button>

              </div>
            </div>
          )}
            </Tailwind.TabPanel>

            <Tailwind.TabPanel name={t('collection:browse.tabs.mods')}>
              <div className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:py-16">
                {/* Icon */}
                <Tailwind.Icon path="mdiClockOutline" size='xl' className="tw:w-9 tw:h-9 tw:text-neutral-subdued" />

                {/* Heading */}
                <Tailwind.Typography typographyType="body-xl" appearance="subdued" className='tw:font-semibold'>
                  {t('collection:browse.modsComingSoon.title')}
                </Tailwind.Typography>

                {/* Description */}
                <Tailwind.Typography typographyType="body-lg" appearance="subdued" className="tw:text-center">
                  {t('collection:browse.modsComingSoon.description')}
                </Tailwind.Typography>

                {/* Button */}
                <Tailwind.Button
                  buttonType="tertiary"
                  size="sm"
                  filled="weak"
                  leftIconPath="mdiOpenInNew"
                  onClick={() => {
                    const game = getGame(gameId);
                    const domainName = nexusGameId(game, gameId);
                    const nexusUrl = `https://www.nexusmods.com/games/${domainName}/mods`;
                    opn(nexusUrl).catch(() => undefined);
                  }}
                >
                  {t('collection:browse.modsComingSoon.openWebsite')}
                </Tailwind.Button>
              </div>
            </Tailwind.TabPanel>
          </Tailwind.TabProvider>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default BrowseNexusPage;
