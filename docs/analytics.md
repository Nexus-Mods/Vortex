# Analytics

How Vortex reports usage to Mixpanel: the properties every event carries, how IDs resolve
to names, and how to add tracking to an extension. The code is in
`src/renderer/src/extensions/analytics/`.

## Super properties

Registered once and attached by Mixpanel to every event, so no event passes them itself.
Registered in `src/renderer/src/extensions/analytics/mixpanel/MixpanelAnalytics.ts`.

| Property        | Value                                    | Set                                     |
| --------------- | ---------------------------------------- | --------------------------------------- |
| `user_type`     | `premium`, `supporter` or `registered`   | at start, from the logged-in membership |
| `platform_type` | always `app`                             | at start                                |
| `app_name`      | always `Vortex`                          | at start                                |
| `app_version`   | the running Vortex version               | at start                                |
| `game_id`       | numeric Nexus game id of the active game | on game or profile switch               |
| `profile_id`    | the active profile's id                  | on game or profile switch               |

The user is identified by their Nexus user id, so `distinct_id` is also on every event.
IP-based geolocation is added by Mixpanel itself.

`game_id` and `profile_id` are cleared when no game is active, such as on the games
dashboard, so a game-agnostic event can't carry a stale game. If the Nexus games list hasn't
loaded yet, the previous `game_id` is kept and set again once it loads. The game context is
wired up in `src/renderer/src/extensions/analytics/index.ts`.

Events queued before analytics starts are sent once it does, so they get the super properties
of the moment they are sent, not the moment they happened.

## Lookup tables

Mixpanel maps IDs to names through lookup tables, so events send the ID and never the name.

- `mod_uid`: any event with a `mod_uid` property resolves to the `lkt_mods` lookup table,
  which gives the mod name. Add `mod_uid` to the event and the name comes with it. Don't
  add `mod_name`, and don't add the game-scoped `mod_id` alongside it.
- `game_id`: resolves to the game name the same way. Never add `game_name`. It is a super
  property (see above), so most events already carry it.

A name sent on the event is frozen at the time it was sent, so a renamed mod or game splits
across names in a report. The lookup table keeps one current name per ID.

## Adding events

Give each extension its own tracker rather than building events inline or adding them to the
shared catalogue in `src/renderer/src/extensions/analytics/mixpanel/MixpanelEvents.ts`. Health
Check is the model: `src/renderer/src/extensions/health_check/hooks/healthCheckTracker.ts`.

- A factory, `createXTracker(api)`, returns one typed method per event, such as
  `trackDetailViewed(props)`. Components say what happened; the tracker owns the event name
  and the property shape, so a typo or a missing property fails the build rather than
  silently landing in the data.
- Each method emits on the `analytics-track-mixpanel-event` bus. The analytics extension
  handles consent and queueing, so trackers don't check either.
- Don't repeat super properties, and send IDs rather than names (see above).
- Drop `undefined` values before emitting, so an optional property is left off rather than
  sent as null.
- When many events share scope, such as the issue a Health Check event belongs to, supply it
  from a React context
  (`src/renderer/src/extensions/health_check/hooks/HealthCheckTracking.context.tsx`) instead
  of passing it at every call site, where a miss is invisible until the data is wrong.
- Keep the factory free of React, so non-component code (checks, install actions) can build
  one too.

The tracker file is where an extension's events are documented: comment each method with
anything about the event that isn't obvious from its properties.
