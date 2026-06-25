# @vortex/nexus-api-v3

Typed HTTP client for the Nexus Mods OpenAPI v3 API.

## Codegen

`pnpm codegen` runs `openapi-typescript` against
`https://api.nexusmods.com/openapi.yaml` to produce
`src/generated/nexus-api-v3.d.ts` (gitignored).

`postinstall` runs `codegen`, so installing always regenerates the bindings
from the latest spec — the same network you already need to install the
dependency tree. `build` only runs `tsdown` against that generated output, so
builds never hit the network and work offline.

Fetching the latest spec on every install keeps the bindings current but means
the generated types can change between installs.
