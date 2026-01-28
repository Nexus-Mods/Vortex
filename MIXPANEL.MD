# Mixpanel Analytics Guide

This guide explains how to work with Mixpanel analytics in Vortex, including accessing the development project and adding new events.

## Quick Navigation Reference

| Task | Mixpanel Location |
|------|-------------------|
| See events (real-time & historical) | **Events** (sidebar) |
| Browse all event definitions | **Lexicon** (sidebar) |
| Explore user data | **Users** (sidebar) |
| Build reports/charts | **Home** > create a new report |
| Switch projects (dev/prod) | **Project selector** (top-left dropdown) |

## Environment Separation

Vortex uses **two separate Mixpanel projects** to keep development/testing data separate from production:

| Environment | When Used | Token Constant |
|-------------|-----------|----------------|
| **Development** | `NODE_ENV === "development"` (when running `yarn start`) | `MIXPANEL_DEV_TOKEN` |
| **Production** | `NODE_ENV !== "development"` (release builds) | `MIXPANEL_PROD_TOKEN` |

The environment is determined in `src/extensions/analytics/index.ts:144`:
```typescript
const isProduction = process.env.NODE_ENV !== "development";
```

## Accessing Mixpanel Projects

### Development Project (for testing)

1. Go to [mixpanel.com](https://mixpanel.com) and log in
2. Click the project selector dropdown (top-left, next to the Mixpanel logo)
3. Select the **Vortex Development** project (or similarly named dev project)
4. Your test events will appear here when running Vortex via `yarn start`

### Production Project

1. Same login process
2. Select the **Vortex** or **Vortex Production** project
3. Contains real user data - use for reporting/analysis only

## Viewing Events

### Events (Real-time & Historical)
Best for verifying your events are firing correctly:
1. Click **Events** in the sidebar
2. You'll see a stream of events as they come in
3. Use the search/filter bar to find specific events (e.g., search "collections")
4. Click any event row to expand and see all its properties
5. Adjust the time range to see historical data

**For testing new events:**
1. Run Vortex in development mode (`yarn start`)
2. Have the Events page open in Mixpanel (dev project)
3. Trigger your action in Vortex
4. Watch the event appear in the stream

### Lexicon (Event Definitions)
To see all tracked events and their schemas:
1. Click **Lexicon** in the sidebar
2. You'll see a list of all events ever sent to this project
3. Use the search bar to find specific events
4. Click on any event to see:
   - **Properties**: All properties sent with this event
   - **Volume**: How often it's been fired
   - **Description**: Team documentation (if added)

### Viewing Event Properties
To see what properties an event has:
1. Click **Lexicon** in the sidebar
2. Click on the event name
3. View the **Properties** section
4. Each property shows its name, type (string/number/etc.), and example values

To see ALL properties across all events:
1. In **Lexicon**, switch to the **Event Properties** tab
2. Useful for finding inconsistencies (e.g., `user_id` vs `userId`)

### Building Reports
To analyze event data:
1. Click **Home** in the sidebar
2. Create a new Insight/Report
3. Select your event from the event picker
4. **Breakdown**: Split data by a property (e.g., `game_name`)
5. **Filter**: Narrow results (e.g., only `creation_method = "from_profile"`)
6. **Time range**: Adjust the date picker to see historical data

## Testing Mixpanel Events in Vortex

To test that Mixpanel events are firing correctly, you need to perform specific actions in Vortex. Here's what user actions trigger each event:

### Events and Corresponding Vortex Actions

| Event Name | Vortex User Action | How to Trigger |
|------------|-------------------|----------------|
| `collection_drafted` | Creating a new collection draft | See methods below |
| `collection_draft_uploaded` | Uploading a new collection draft | Export collection to Nexus Mods API |
| `collection_draft_updated` | Updating an existing collection | Export updated collection to Nexus Mods API |

### How to Trigger "collection_drafted"

This event fires when you create a new collection draft. There are three ways to trigger it:

#### Method 1: Create Empty Collection (`creation_method: "empty"`)

1. Open Vortex and select your game
2. Go to the **Collections** tab in the sidebar
3. Click **Create New Collection** (or similar button)
4. Choose to create an **empty/blank** collection
5. Name your collection
6. The event fires with `creation_method: "empty"`

#### Method 2: Create from Profile (`creation_method: "from_profile"`)

1. In Vortex, switch to the **Profiles** tab
2. Select an existing profile with mods you want to share
3. Use the **Create Collection from Profile** option
4. Configure collection settings
5. The event fires with `creation_method: "from_profile"`

#### Method 3: Create Quick Collection (`creation_method: "quick_collection"`)

1. In Vortex, use the **Quick Collection** feature
2. Select mods or use the quick collection workflow
3. Complete the quick collection creation
4. The event fires with `creation_method: "quick_collection"`

### How to Trigger "collection_draft_uploaded"

This event fires when you upload a collection draft to Nexus Mods for the **first time**:

1. Create a collection (using any method above)
2. Configure your collection with mods, rules, and metadata
3. Click **Export to Nexus** or **Upload Collection**
4. Ensure this is a **new upload** (not an update to existing collection)
5. The event fires with collection name, game name, and your user ID

### How to Trigger "collection_draft_updated"

This event fires when you upload an **update** to an existing collection:

1. Open an existing collection that you previously uploaded
2. Make changes to the collection (add/remove mods, update rules, etc.)
3. Click **Export to Nexus** or **Upload Collection**
4. Since the collection already has a `collectionId`, Vortex recognizes this as an update
5. The event fires with collection name, game name, and your user ID

### Testing Checklist

When testing events in development:

- [ ] Ensure you're logged into Nexus Mods in Vortex
- [ ] Enable analytics in Vortex settings (if not already enabled)
- [ ] Have Mixpanel Development project open in browser
- [ ] Trigger the user action in Vortex
- [ ] Verify event appears in Mixpanel Events stream
- [ ] Check that properties are correct (collection_name, game_name, user_id, creation_method)

## Adding New Events

### Do I Need to Create Events in Mixpanel First?

**No.** Mixpanel is schema-less - events are automatically created when first received. You don't need to pre-define events or properties in the Mixpanel UI.

**What happens automatically:**
- First time an event is sent, Mixpanel creates it
- Properties are auto-detected from the data you send
- Events appear in Lexicon within minutes of first firing

**What you should do afterward (recommended but optional):**
- Add descriptions to events in **Lexicon** for team documentation
- Tag events for easier filtering
- Hide test/deprecated events from reports

### 1. Define the Event Class

Add your event class to `src/extensions/analytics/mixpanel/MixpanelEvents.ts`:

```typescript
/**
 * Event sent when [describe when this fires].
 * @param collection_name Name of the collection
 * @param game_name Name of the game
 * @param user_id User ID
 * @param creation_method How the collection was created
 */
export class CollectionsDraftedEvent implements MixpanelEvent {
  readonly eventName = "collection_drafted";
  readonly properties: Record<string, any>;

  constructor(
    collection_name: string,
    game_name: string,
    user_id: number,
    creation_method: "from_profile" | "quick_collection" | "empty",
  ) {
    this.properties = {
      collection_name,
      game_name,
      user_id,
      creation_method,
    };
  }
}
```

### 2. Export from API (if needed)

If the event needs to be used by bundled extensions (in `extensions/`), add the export to:
- `src/util/api.ts` - main API exports
- `api/lib/extensions/analytics/mixpanel/MixpanelEvents.d.ts` - type definitions

### 3. Fire the Event

Emit the event using the `analytics-track-mixpanel-event` event:

```typescript
import { CollectionsDraftedEvent } from "../analytics/mixpanel/MixpanelEvents";

// When the action occurs:
api.events.emit(
  "analytics-track-mixpanel-event",
  new CollectionsDraftedEvent(
    collectionName,
    gameName,
    userId,
    "from_profile"
  )
);
```

### 4. Test in Development

1. Run Vortex: `yarn start`
2. Open Mixpanel, switch to the Development project (top-left selector)
3. Click **Events** in the sidebar
4. Trigger your event action in Vortex
5. Verify the event name and properties appear correctly

## Event Naming Convention

Follow the Mixpanel naming convention with **Title Case and colons**:

```
[Category]: [Action description]
```

Examples:
- `collection_drafted`
- `collection_draft_uploaded`
- `collection_draft_updated`

## Standard Properties

Include these properties on collection-related events:

| Property | Type | Description |
|----------|------|-------------|
| `collection_name` | string | Name of the collection |
| `game_name` | string | Name of the game |
| `user_id` | number | Nexus Mods user ID |

Additional context-specific properties as needed (e.g., `creation_method`, `error_code`).

## Mixpanel UI Workflow

Here's what to do in the Mixpanel web interface at each stage:

### Before Coding (Nothing Required)

Mixpanel doesn't require you to pre-register events. Just start coding.

### During Development (Testing)

1. **Switch to the Development project** (project selector, top-left)
2. **Open Events**: Click **Events** in the sidebar
3. **Filter by your event** (optional): Use the search/filter to find your specific event
4. **Run Vortex** with `yarn start` and trigger your action
5. **Verify the event appears** with correct name and properties

### After Merging to Production (Optional Cleanup)

Once your events are live, consider documenting them in Lexicon:

1. Click **Lexicon** in the sidebar
2. Find your new event(s)
3. Click on the event to edit:
   - **Description**: Explain what triggers this event
   - **Tags**: Add tags like `collections`, `vortex-client`
   - **Status**: Mark as "Visible" (default) or "Hidden"
4. Click on individual properties to add descriptions

This documentation helps other team members understand the data.

### Hiding Test/Deprecated Events

If you've sent test events with typos or old naming:
1. Click **Lexicon** in the sidebar
2. Find the unwanted event
3. Click it and set **Status** to "Hidden"
4. Hidden events won't appear in report builders (but data is retained)

## Debugging

Enable analytics debug logging by checking the console output. The analytics service logs events with the `[mixpanel]` prefix:

```
[mixpanel] debug: Event tracked { eventName: "...", properties: {...} }
```

If events aren't appearing:
1. Verify you're logged into Vortex (analytics require authentication)
2. Check that analytics are enabled in Vortex settings
3. Confirm you're looking at the correct Mixpanel project (dev vs prod)
4. Check the browser console for any errors

## Files Reference

| File | Purpose |
|------|---------|
| `src/extensions/analytics/mixpanel/MixpanelEvents.ts` | Event class definitions |
| `src/extensions/analytics/mixpanel/MixpanelAnalytics.ts` | Mixpanel SDK wrapper |
| `src/extensions/analytics/constants.ts` | Tokens and configuration |
| `src/extensions/analytics/index.ts` | Analytics extension entry point |
