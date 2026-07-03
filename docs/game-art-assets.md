# Game Art Assets in Vortex

This document explains where game art (logos, tiles, thumbnails) comes from, how Vortex chooses which image to show on each surface, and the conventions game extensions should follow. It reflects the state after the Games page was migrated to the Nexus **tile** artwork.

---

## Table of Contents

1. [The art sources](#the-art-sources)
2. [The two Nexus image URLs](#the-two-nexus-image-urls)
3. [Where art is used, and the precedence per surface](#where-art-is-used-and-the-precedence-per-surface)
4. [How the numeric Nexus id is resolved](#how-the-numeric-nexus-id-is-resolved)
5. [Caching and offline behaviour](#caching-and-offline-behaviour)
6. [Extension authoring guidance](#extension-authoring-guidance)
7. [Key files](#key-files)

---

## The art sources

For any game, up to five distinct image sources can be in play. Which ones are available depends on whether the game's support extension is installed and whether the game maps to a Nexus game id.

| Source                         | Origin                                            | Shape / size           | Availability                                                    |
| ------------------------------ | ------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| **Nexus `tile.jpg`**           | Nexus CDN                                         | 2:3 portrait, 400×600  | remote; needs a numeric Nexus id                                |
| **Nexus `thumbnail.jpg`**      | Nexus CDN                                         | 1:1 square, 80×80      | remote; needs a numeric Nexus id                                |
| **Local logo** (`gameart.jpg`) | game extension folder (`extensionPath` + `logo`)  | authored per extension | local file; only when the extension is installed                |
| **`imageURL`**                 | game support extension **manifest** (`ext.image`) | author-supplied        | remote; used for **uninstalled** extensions (no local logo yet) |
| **Custom `icon.png`**          | `{userData}/{gameId}/icon.png`                    | user-provided          | local file; only if the user set a custom icon                  |

Notes:

- The **local logo** is the reliability floor: it ships inside the extension, works offline, and covers non-Nexus/community games that have no numeric id.
- **`imageURL`** exists because an _uninstalled_ extension has no folder on disk (`extensionPath` is undefined), so the only art available is the preview URL carried in its manifest metadata.
- The **custom `icon.png`** is written when a user sets a custom game/tool icon via the Starter (Tools) dashlet; it is also used for OS shortcut icons, so it must remain a real local file.

---

## The two Nexus image URLs

Both are built the same way — resolve the game's numeric Nexus id, then request a named rendition from the Nexus image CDN. Only the filename differs:

```
https://images.nexusmods.com/images/games/v2/{numericId}/tile.jpg       // 2:3 portrait, 400×600
https://images.nexusmods.com/images/games/v2/{numericId}/thumbnail.jpg  // 1:1 square, 80×80
```

- **`tile.jpg`** matches the game tiles on the Nexus Mods website. Used on the **Games page**.
- **`thumbnail.jpg`** is a small square icon. Used in the **Spine** sidebar (modern layout).

Neither is bundled by Vortex; both are fetched from Nexus at runtime.

The `tile.jpg` URL is built by the shared helper `gameTileImageURL()`
(`src/renderer/src/extensions/nexus_integration/util/gameTileImageURL.ts`), which returns `undefined`
when no numeric id resolves (e.g. non-Nexus games).

---

## Where art is used, and the precedence per surface

Art is chosen by a **priority order** per surface — the first available source wins.

| Surface                                                    | UI mode      | Priority order                                               | Nexus art?                |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------ | ------------------------- |
| **Games page** — `GameThumbnail` (grid) / `GameRow` (list) | both         | `tile.jpg` → local logo → `imageURL`                         | ✅ tile                   |
| **Dashboard** — Recently Managed dashlet                   | both         | _(reuses `GameThumbnail`)_                                   | ✅ tile                   |
| **Spine** sidebar — `GameButton`                           | modern only  | local logo → `imageURL` → `thumbnail.jpg` (cached, upgrades) | ✅ thumbnail              |
| **QuickLauncher** — active-game widget in the toolbar      | classic only | custom `icon.png` → local logo                               | ❌ local only             |
| **Profiles** — `ProfileItem`                               | both         | user profile image → local logo                              | ❌ local only             |
| **OS shortcuts** — `StarterInfo`                           | n/a          | custom `icon.png` → local logo                               | ❌ must stay a local file |
| **Extension browser** — `BrowseExtensions`                 | both         | manifest `ext.image` directly                                | manifest image            |

Key consequences:

- On the **Games page**, a Nexus game (once the games list has loaded) always shows `tile.jpg`. The local logo / `imageURL` only appear for **non-Nexus games**, or briefly at startup/offline before the list resolves.
- **`imageURL`** is therefore mostly bypassed on the Games page (reached only by uninstalled extensions of non-Nexus games). It remains fully used in the **Spine** and the **extension browser**.
- **QuickLauncher, Profiles, and OS shortcuts** never use Nexus art — they resolve a local file (custom icon or packaged logo). They benefit automatically as extensions ship 2:3 art.
- `GameThumbnail` is shared by the Games page **and** the Recently Managed dashlet, so any change to it affects both.

---

## How the numeric Nexus id is resolved

The Nexus image URLs need a **numeric** game id, but games are identified internally by a domain string. Resolution:

1. `nexusGameId(game)` (`src/renderer/src/extensions/nexus_integration/util/convertGameId.ts`) →
   the Nexus **domain name** (honours `game.details.nexusPageId` and a few hard-coded aliases such as
   `skyrimse` → `skyrimspecialedition`).
2. Look the domain up in the cached Nexus games list `nexusGames()`
   (`src/renderer/src/extensions/nexus_integration/util.ts`, sourced from `games.json`) to get the numeric `id`.

If the games list has not loaded yet, or the game has no matching entry, no Nexus URL is produced and the
surface falls back to local art.

---

## Caching and offline behaviour

There are two very different caching stories:

- **Games page (`<Image>` / raw remote URL):** relies on Chromium's normal **HTTP cache** in the default
  Electron session (persists across launches; nothing clears it at startup). A returning, online user is
  typically served tiles from cache; the first sighting of a tile is a network fetch. There is **no
  application-level cache and no runtime fallback**: if a tile fails (offline with a cold cache, or 404),
  the design-system `Image` component shows its broken-image icon.
- **Spine sidebar:** has a deliberate **application cache** at `{userData}/icon_cache/` with a 3-day TTL
  (`src/renderer/src/views/components/Spine/utils.ts`). It shows the local logo instantly, background-downloads
  the Nexus `thumbnail.jpg`, caches it to disk, and upgrades in place — so it degrades gracefully offline.

---

## Extension authoring guidance

- Game extensions declare their local art via the `logo` field (conventionally `logo: "gameart.jpg"`, with the
  file shipped alongside the extension). See the `logo` doc comment in `src/renderer/src/types/ITool.ts`.
- **New extensions should author `gameart.jpg` at 2:3 (400×600)** so the local fallback matches the Nexus tile
  shape on the Games page. Existing 16:9 assets keep working — they are cover-cropped in the 2:3 box — and can
  convert over time; there is no bulk migration.
- Keep the background transparent and avoid embedding the game name (Vortex renders the name as text near the art).

### Known, accepted downside

A game that still ships a **16:9 `gameart.jpg`** _and_ whose local logo is actually shown on the Games page
(i.e. a non-Nexus game, or startup/offline) will be cover-cropped in the 2:3 tile (top/bottom clipped). This is
accepted; it self-resolves as extensions adopt 2:3 art.

---

## The design-system `Image` component

The Games-page tiles render through the shared `Image` component
(`src/renderer/src/ui/components/image/Image.tsx`), using `imageType="game"` (a 2:3 aspect box backed by the
`--aspect-game: 2 / 3` theme token in `src/stylesheets/ui/theme/generic.css`). The component provides the
design-spec inner border and the broken-image fallback for free.

Because `Image` uses an **aspect-ratio box**, the tile needs a resolved width _or_ height from its container:

- **Games page grid** (`.game-group`) supplies width via `grid-template-columns`; the tile fills its column.
- **Recently Managed dashlet** places the tile in a short flex row, so `gamepicker.scss` gives `.game-thumbnail`
  a default width, and `dashlet.scss` overrides it there with a fixed **height** (width follows the ratio) so it
  fits the dashlet. If a new surface embeds `GameThumbnail`, ensure it constrains either width or height.

The tile overlays (name gradient, active-mod count, "Community" tag, hover menu, info button) render inside the
`Image` component's `children` slot and are lifted above the image with `z-index: 2` (below the component's
`z-5` border, which is `pointer-events-none` so buttons stay clickable).

---

## Key files

| Concern                         | File                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Tile URL helper (`tile.jpg`)    | `src/renderer/src/extensions/nexus_integration/util/gameTileImageURL.ts`                            |
| Domain → numeric id             | `src/renderer/src/extensions/nexus_integration/util/convertGameId.ts`, `.../util.ts` (`nexusGames`) |
| Games page grid tile            | `src/renderer/src/extensions/gamemode_management/views/GameThumbnail.tsx`                           |
| Games page list row             | `src/renderer/src/extensions/gamemode_management/views/GameRow.tsx`                                 |
| Games page container            | `src/renderer/src/extensions/gamemode_management/views/GamePicker.tsx`                              |
| Recently Managed dashlet        | `src/renderer/src/extensions/gamemode_management/views/RecentlyManagedDashlet.tsx`                  |
| Spine sidebar art + cache       | `src/renderer/src/views/components/Spine/utils.ts`, `GameButton.tsx`                                |
| QuickLauncher (classic)         | `src/renderer/src/views/QuickLauncher.tsx`, `src/renderer/src/util/StarterInfo.ts`                  |
| Profiles                        | `src/renderer/src/extensions/profile_management/views/ProfileItem.tsx`                              |
| Extension browser               | `src/renderer/src/extensions/extension_manager/BrowseExtensions.tsx`                                |
| `Image` component + `game` type | `src/renderer/src/ui/components/image/Image.tsx`                                                    |
| Aspect token                    | `src/stylesheets/ui/theme/generic.css` (`--aspect-game`)                                            |
| Games page styling              | `src/stylesheets/vortex/gamepicker.scss`                                                            |
| Dashlet tile sizing             | `src/stylesheets/vortex/dashlet.scss`                                                               |
| `logo` field contract           | `src/renderer/src/types/ITool.ts`                                                                   |
