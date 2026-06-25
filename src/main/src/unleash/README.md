# Unleash

- `./openapi.json` fetched from `https://unleash.nexusmods.com/docs/openapi.json`
- `./openapi-slim.json` trimmed to only `/api/frontend` and its schema dependencies via `node src/unleash/trim-spec.mjs`
- `./schema.d.ts` generated with `pnpm exec openapi-typescript src/unleash/openapi-slim.json --immutable --output src/unleash/schema.d.ts`
