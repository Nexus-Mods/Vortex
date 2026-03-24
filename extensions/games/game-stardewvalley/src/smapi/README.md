# SMAPI Module (Stardew Valley)

This folder contains all SMAPI-specific logic used by the Stardew Valley
extension.

## Public API

Import SMAPI functionality from `smapi/index.ts` only:

- mod/tool selectors (`findSMAPITool`, `getSMAPIMods`, `findSMAPIMod`)
- deployment helper (`deploySMAPI`)
- explicit download/install steps (`downloadSMAPI`, `installDownloadedSMAPI`,
  `enableSMAPIMod`)
- orchestration helper (`downloadAndInstallSMAPI`)
- compatibility metadata adapter (`SMAPIProxy`)

All exported SMAPI functions use TSDoc with explicit `@param` and `@returns`
entries.

## File Map

- `index.ts`
    - stable exports-only entrypoint for consumers.
- `selectors.ts`
    - reads Redux state and resolves discovered tool + active SMAPI mods.
- `lifecycle.ts`
    - deploy + quick discovery + primary-tool activation workflow.
- `download.ts`
    - download-only SMAPI acquisition logic from Nexus.
- `install.ts`
    - installs downloaded SMAPI archives and enables them for the active profile.
- `workflow.ts`
    - orchestrator that composes download/install/enable and runs post-install
      deployment/notifications.
- `proxy.ts`
    - SMAPI.io compatibility lookup adapter with Nexus fallback metadata lookup.
- `version.ts`
    - SMAPI-compatible semver coercion/comparison helpers used by proxy lookups.

## Common contributor tasks

- Change tool/mod discovery logic:
    - edit `selectors.ts`.
- Change download source or archive download behavior:
    - edit `download.ts`.
- Change install/enable behavior after download:
    - edit `install.ts` and/or `workflow.ts`.
- Change compatibility metadata lookup behavior:
    - edit `proxy.ts`.
