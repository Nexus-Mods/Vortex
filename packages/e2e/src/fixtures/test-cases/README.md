# Data-driven E2E test cases

YAML files under `games/<gameId>/` register as individual Playwright tests through `src/tests/data-driven.spec.ts`.

```bash
pnpm e2e
VORTEX_E2E_GREP="@case:gothic1remake-ue4ss" pnpm e2e:debug
VORTEX_E2E_GREP="@game:stardewvalley.*@user:premium" pnpm e2e
```

## Full annotated example

Save this as `games/gothic1remake/ue4ss.yml`. The `gothic1remake` folder name
becomes the default managed game id.

```yml
# Case id.
id: gothic1remake-ue4ss

# What logic to run on this case.
flow: manage-download-and-deploy

# Suite/title.
suite: Gothic 1 Remake - UE4SS
title: installs UE4SS from Nexus and deploys injector files

fixtures:
    # Game extension.
    dynamicGameExtensionId: gothic1remake

    # Use instead of Matrix for single user.
    # nexusUser: free

matrix:
    # Run once as free, once as premium.
    nexusUser:
        - free
        - premium

download:
    # Mod page.
    modUrl: https://www.nexusmods.com/gothic1remake/mods/3?tab=files

    # Mod page URL assert.
    expectedUrl:
        regex: gothic1remake/mods/3

    # File in Files tab.
    expectedModRow:
        regex: UE4SS-3
        flags: i

    # Optional: choose one file row when Nexus page has multiple Mod Manager links.
    fileName:
        regex: UE4SS
        flags: i

    # No nxm://.
    missingNxmMessage: No nxm:// URL appeared in the page after the UE4SS download click

deploy:
    # Expected files in game folder after deployment.
    expectedFiles:
        - G1R/Binaries/Win64/dwmapi.dll
        - G1R/Binaries/Win64/UE4SS.dll
        - G1R/Binaries/Win64/UE4SS-settings.ini

    # Can also specify platform-specific files like this:
    # expectedFiles:
    #   common:
    #       - ...
    #   linux:
    #       - ...
    #   windows:
    #       - ...

    # Error text.
    message: Expected UE4SS files to deploy
```

## Field notes

`manage-download-and-deploy` manages the game, downloads the mod, and can
deploy files when `deploy` is set.

Do not mix `matrix.nexusUser` with `fixtures.nexusUser`.

`gameId` comes from the folder name:

```text
games/gothic1remake/ue4ss.yml -> gameId gothic1remake
```

Matchers:

```yml
expectedModRow:
    regex: UE4SS-3
    flags: i
```
