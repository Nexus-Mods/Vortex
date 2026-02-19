/**
 * CollectionTile Demo Component
 * Demonstrates the CollectionTile component with mock data
 */

import type { ICollection } from "@nexusmods/nexus-api";

import React, { type ComponentType } from "react";

import type { IExtensionApi } from "../../../../types/IExtensionContext";

import { Typography } from "../typography";
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
      id: 1,
      gameId: 1303,
      slug: "ultimate-civil-war-reloaded",
      name: "Ultimate Civil War Reloaded",
      user: {
        name: "RyukanoHi",
        avatar: undefined,
      },
      coverImage: "https://placehold.co/166x207/1f1f1f/ffffff?text=Collection",
      tags: [
        createMockTag({ id: "1", name: "Total Overhaul" }),
        createMockTag({ id: "2", name: "Adult" }),
      ],
      stats: {
        endorsements: 320,
        size: 540000000,
        modCount: 320,
      },
      summary:
        "1.6.8 The story of Stardew Valley expands outside of Pelican Town with this expanded collection designed to stay true to the original game. Created with co-op in mind, perfect for experienced solo-players. Easy install, includes configuration.",
      version: "1.6.8",
    },
    {
      id: 2,
      gameId: 1303,
      slug: "immersive-graphics-overhaul",
      name: "Immersive Graphics Overhaul",
      user: {
        name: "GraphicsMod",
        avatar: undefined,
      },
      coverImage: "https://placehold.co/166x207/2a2a2a/ffffff?text=Graphics",
      tags: [
        createMockTag({ id: "3", name: "Graphics" }),
        createMockTag({ id: "4", name: "Performance" }),
      ],
      stats: {
        endorsements: 890,
        size: 21000000,
        modCount: 1520,
      },
      summary:
        "Complete graphics overhaul with enhanced textures, lighting, and weather effects. Optimized for performance with minimal FPS impact. Includes ENB preset and configuration tool.",
    },
    {
      id: 3,
      gameId: 1303,
      name: "Quest Expansion Pack",
      slug: "quest-expansion-pack",
      user: {
        name: "QuestMaster",
        avatar: undefined,
      },
      coverImage: "https://placehold.co/166x207/1a1a1a/ffffff?text=Quests",
      tags: [createMockTag({ id: "5", name: "Quests" })],
      stats: {
        endorsements: 425,
        size: 1200004,
        modCount: 650,
      },
      summary:
        "Adds 50+ new quests with unique storylines, characters, and rewards. Fully voice-acted with professional cast. Compatible with all major mods.",
    },
  ] as unknown as ICollection[];

  return (
    <div className="space-y-8 p-6">
      <Typography
        appearance="strong"
        as="h1"
        className="mb-6"
        typographyType="heading-2xl"
      >
        Collection Tile Component
      </Typography>

      <Typography appearance="subdued" className="mb-8">
        Collection tiles for browsing and managing mod collections. Based on
        Figma design specifications. Maximum 2 tags shown, no icons
        (placeholders only), with primary and tertiary action buttons.
      </Typography>

      {/* Collections grid */}
      <div className="space-y-6">
        <Typography
          appearance="strong"
          as="h2"
          className="mb-4"
          typographyType="heading-xl"
        >
          Sample Collections
        </Typography>

        <div className="flex flex-col gap-6">
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

      {/* Feature notes */}
      <div className="mt-8 rounded-sm border border-yellow-200 bg-yellow-50 p-4">
        <Typography appearance="moderate" as="p" typographyType="body-sm">
          <strong>Design Notes:</strong> Fixed dimensions (465x288px), max 2
          tags displayed, "Adult" tag uses danger-400 color (#F87171), no hover
          effects on card (only buttons), icons are placeholder divs (no actual
          icons rendered).
        </Typography>
      </div>
    </div>
  );
};
