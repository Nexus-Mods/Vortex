/**
 * CollectionTile Demo Component
 * Demonstrates the CollectionTile component with mock data
 */

import * as React from 'react';
import { CollectionTile } from './CollectionTile';
import { Typography } from '../typography/Typography';

export interface ICollectionTileDemoProps {
  api: any;
}
export const CollectionTileDemo: React.ComponentType<ICollectionTileDemoProps> = ({ api }) => {
  const handleAddCollection = (title: string) => {
    console.log('Add collection:', title);
  };

  const handleViewPage = (title: string) => {
    console.log('View page:', title);
  };

  const gameId = 'stardewvalley';

  const mockCollections = [
    {
      id: '1',
      gameId,
      slug: 'ultimate-civil-war-reloaded',
      title: 'Ultimate Civil War Reloaded',
      author: {
        name: 'RyukanoHi',
        avatar: undefined,
      },
      coverImage: 'https://placehold.co/166x207/1f1f1f/ffffff?text=Collection',
      tags: ['Total Overhaul', 'Adult'],
      stats: {
        endorsements: 320,
        size: 540000000,
        modCount: 320
      },
      description: '1.6.8 The story of Stardew Valley expands outside of Pelican Town with this expanded collection designed to stay true to the original game. Created with co-op in mind, perfect for experienced solo-players. Easy install, includes configuration.',
      version: '1.6.8',
    },
    {
      id: '2',
      gameId,
      slug: 'immersive-graphics-overhaul',
      title: 'Immersive Graphics Overhaul',
      author: {
        name: 'GraphicsMod',
        avatar: undefined,
      },
      coverImage: 'https://placehold.co/166x207/2a2a2a/ffffff?text=Graphics',
      tags: ['Graphics', 'Performance'],
      stats: {
        endorsements: 890,
        size: 21000000,
        modCount: 1520
      },
      description: 'Complete graphics overhaul with enhanced textures, lighting, and weather effects. Optimized for performance with minimal FPS impact. Includes ENB preset and configuration tool.',
    },
    {
      id: '3',
      gameId,
      title: 'Quest Expansion Pack',
      slug: 'quest-expansion-pack',
      author: {
        name: 'QuestMaster',
        avatar: undefined,
      },
      coverImage: 'https://placehold.co/166x207/1a1a1a/ffffff?text=Quests',
      tags: ['Quests'],
      stats: {
        endorsements: 425,
        size: 1200004,
        modCount: 650,
      },
      description: 'Adds 50+ new quests with unique storylines, characters, and rewards. Fully voice-acted with professional cast. Compatible with all major mods.',
    },
  ];

  return (
    <div className="tw:p-6 tw:space-y-8">
      <Typography
        as="h1"
        typographyType="heading-2xl"
        appearance="strong"
        className="tw:mb-6"
      >
        Collection Tile Component
      </Typography>

      <Typography
        as="p"
        typographyType="body-md"
        appearance="subdued"
        className="tw:mb-8"
      >
        Collection tiles for browsing and managing mod collections. Based on Figma design
        specifications. Maximum 2 tags shown, no icons (placeholders only), with primary and
        tertiary action buttons.
      </Typography>

      {/* Collections grid */}
      <div className="tw:space-y-6">
        <Typography
          as="h2"
          typographyType="heading-xl"
          appearance="strong"
          className="tw:mb-4"
        >
          Sample Collections
        </Typography>

        <div className="tw:flex tw:flex-col tw:gap-6">
          {mockCollections.map((collection) => (
            <CollectionTile
              key={collection.id}
              {...collection}
              onAddCollection={() => handleAddCollection(collection.title)}
              onViewPage={() => handleViewPage(collection.title)}
              api={api}
              adultContent={collection.tags.includes('Adult')}
            />
          ))}
        </div>
      </div>

      {/* Feature notes */}
      <div className="tw:p-4 tw:bg-yellow-50 tw:rounded tw:border tw:border-yellow-200 tw:mt-8">
        <Typography
          as="p"
          typographyType="body-sm"
          appearance="moderate"
        >
          <strong>Design Notes:</strong> Fixed dimensions (465x288px), max 2 tags displayed,
          "Adult" tag uses danger-400 color (#F87171), no hover effects on card (only buttons),
          icons are placeholder divs (no actual icons rendered).
        </Typography>
      </div>
    </div>
  );
};
