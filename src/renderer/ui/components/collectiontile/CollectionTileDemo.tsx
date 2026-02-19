/**
 * CollectionTile Demo Component
 * Demonstrates the CollectionTile component with mock data
 */

import type { ICollection } from "@nexusmods/nexus-api";

import React, { type ComponentType } from "react";

import type { IExtensionApi } from "../../../types/IExtensionContext";

import { Typography } from "../typography/Typography";
import { CollectionTile } from "./CollectionTile";

export interface ICollectionTileDemoProps {
  api: IExtensionApi;
}
export const CollectionTileDemo: ComponentType<ICollectionTileDemoProps> = ({
  api,
}) => {
  const handleAddCollection = (title: string) => {
    console.log("Add collection:", title);
  };

  const handleViewPage = (title: string) => {
    console.log("View page:", title);
  };

  const createMockTag = ({ id, name }: { id: string; name: string }) => ({
    adult: false,
    discardedAt: null,
    global: false,
    id,
    name,
    updatedAt: "",
    createdAt: "",
  });

  const mockCollections = [
    {
      badges: [{ name: "Easy install" }],
      category: { name: "Total Overhaul" },
      endorsements: 320,
      gameId: 1303,
      id: 1,
      latestPublishedRevision: {
        adultContent: true,
        modCount: 320,
        totalSize: 540000000,
      },
      name: "Ultimate Civil War Reloaded",
      slug: "ultimate-civil-war-reloaded",
      summary:
        "1.6.8 The story of Stardew Valley expands outside of Pelican Town with this expanded collection designed to stay true to the original game. Created with co-op in mind, perfect for experienced solo-players. Easy install, includes configuration.",
      tags: [
        createMockTag({ id: "1", name: "Total Overhaul" }),
        createMockTag({ id: "2", name: "Adult" }),
      ],
      tileImage: { thumbnailUrl: "https://picsum.photos/seed/a/200/150" },
      user: {
        name: "RyukanoHi",
        avatar: "https://picsum.photos/seed/d/50",
      },
    },
    {
      category: { name: "Vanilla Plus" },
      endorsements: 890,
      gameId: 1303,
      id: 2,
      latestPublishedRevision: {
        adultContent: false,
        modCount: 1520,
        totalSize: 21000000,
      },
      name: "Immersive Graphics Overhaul",
      slug: "immersive-graphics-overhaul",
      summary:
        "Complete graphics overhaul with enhanced textures, lighting, and weather effects. Optimized for performance with minimal FPS impact. Includes ENB preset and configuration tool.",
      tags: [
        createMockTag({ id: "3", name: "Graphics" }),
        createMockTag({ id: "4", name: "Performance" }),
      ],
      tileImage: { thumbnailUrl: "https://picsum.photos/seed/b/200/150" },
      user: {
        name: "GraphicsMod",
        avatar: "https://picsum.photos/seed/e/50",
      },
    },
    {
      category: { name: "Themed" },
      endorsements: 425,
      gameId: 1303,
      id: 3,
      latestPublishedRevision: {
        adultContent: true,
        modCount: 650,
        totalSize: 1200004,
      },
      name: "Quest Expansion Pack",
      slug: "quest-expansion-pack",
      summary:
        "Adds 50+ new quests with unique storylines, characters, and rewards. Fully voice-acted with professional cast. Compatible with all major mods.",
      tags: [createMockTag({ id: "5", name: "Quests" })],
      tileImage: { thumbnailUrl: "https://picsum.photos/seed/c/200/150" },
      user: {
        name: "QuestMaster",
        avatar: "https://picsum.photos/seed/f/50",
      },
    },
  ] as unknown as ICollection[];

  return (
    <div className="space-y-8">
      <div className="rounded-sm bg-surface-mid p-4">
        <Typography as="h2" typographyType="heading-sm">
          Collection Tile
        </Typography>

        <Typography appearance="subdued">
          Collection tiles for browsing and managing mod collections. Maximum 2
          tags shown, with primary and tertiary action buttons.
        </Typography>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Sample Collections
        </Typography>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-4">
          {mockCollections.map((collection) => (
            <CollectionTile
              api={api}
              collection={collection}
              key={collection.id}
              onAddCollection={() => handleAddCollection(collection.name)}
              onViewPage={() => handleViewPage(collection.name)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Typography as="h3" typographyType="heading-xs">
          Design Notes
        </Typography>

        <Typography
          appearance="subdued"
          as="ul"
          className="list-inside list-disc space-y-2"
        >
          <li>Maximum 2 tags displayed per tile</li>

          <li>"Adult" tag uses danger-400 color (#F87171)</li>

          <li>No hover effects on card (only buttons)</li>

          <li>Icons are placeholder divs (no actual icons rendered)</li>
        </Typography>
      </div>
    </div>
  );
};
