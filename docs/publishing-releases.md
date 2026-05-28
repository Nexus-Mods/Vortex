# Publishing Releases to Nexus Mods

For release managers: publish stable Vortex releases to Nexus Mods safely and
consistently using the **Publish Release to Nexus Mods** GitHub workflow. This
workflow handles validation, concurrency control, and dry-run testing.

**Quick start:** Go to **Actions → Publish Release to Nexus Mods** and click
**Run workflow**.

## When to Use This Workflow

Use this workflow **after** a stable GitHub Release has been published. This
workflow does **not** build or create releases. It only uploads an existing
release's installer to Nexus Mods.

**Stable releases only.** Beta and alpha releases are distributed via GitHub
Releases and the Vortex auto-update channel; they are **not** uploaded to
Nexus Mods. The script selects the latest **stable** release, skipping newer
drafts and pre-releases.

## Step-by-Step Process

1. **Create the release** via the Package workflow (the GitHub Actions build
   pipeline), which builds the installer and creates a draft GitHub Release.

2. **Publish the release** on GitHub (remove draft status; ensure it is
   **not** marked as a prerelease).

3. **Run the Publish Release workflow** (see below).

## Running the Workflow

1. Go to **Actions → Publish Release to Nexus Mods** in the GitHub
   repository.

2. Click **Run workflow**.

3. Configure the inputs:
    - **Dry-run?**: Leave as `true` (default) on your first run to validate
      without uploading. Set to `false` only after confirming the dry-run
      output.

    - **Nexus game domain slug** (the URL identifier for the game): Defaults
      to `site` (for site mods). Change only if targeting a different game
      domain.

    - **File group ID**: Defaults to `5293` (the live Vortex mod page at
      `nexusmods.com/site/mods/1`). Override to target the test mod page
      (e.g. `nexusmods.com/site/mods/1026`).

4. Click **Run workflow**.

## Safety Guardrails

| Guardrail                      | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| **Manual dispatch only**       | Workflow runs only when manually triggered.                                      |
| **Dry-run default**            | Skips upload by default; set `dry-run: false` to enable.                         |
| **Draft/prerelease rejection** | Workflow rejects draft/prerelease GitHub Releases; only stable releases proceed. |
| **Stable-release selection**   | Selects the latest stable release, skipping newer drafts and pre-releases.       |
| **Concurrency control**        | Only one publish run can execute at a time (`publish-nexus` concurrency group).  |

## What Gets Uploaded

The workflow uploads only the **installer `.exe` file** (e.g.
`Vortex-1-2-0-2-1779192300.exe`) to Nexus Mods.

The `.yml` metadata files (`latest.yml`, `alpha.yml`, `beta.yml`) serve the
Vortex auto-updater and remain on GitHub Releases. They are **not** uploaded
to Nexus Mods.

## File Group ID

The `file-group-id` input controls which Nexus Mods page receives the upload:

| ID           | Target                                                          |
| ------------ | --------------------------------------------------------------- |
| `5293`       | Live Vortex mod page (`nexusmods.com/site/mods/1`), **default** |
| _(override)_ | Test mod page or other target; set the input manually           |

## Troubleshooting

- **"Latest release is a draft"**: Publish the draft release first.
- **"…marked as prerelease but was returned as the latest stable release"**: A
  release changed while the script was running. Re-run the workflow.
- **"No stable (non-draft, non-prerelease) releases found"**: No stable
  release exists. Create and publish a stable release first.

- **"No .exe installer asset found"**: The latest release may not have an
  `.exe` asset. Check that the Package workflow (the build pipeline) completed
  successfully and uploaded the installer.

- **Dry-run looks correct but upload fails**: Verify that `NEXUS_API_KEY` is
  valid and has not expired. Check the workflow run logs for the upload-action
  error details.

## Local Testing and Dry-Run

Run the publish preparation script (`scripts/publish-release-to-nexus/index.ts`)
locally without a GitHub Actions environment - either to run its unit test suite or
to dry-run the preparation step:

```bash
# Run the test suite
pnpm exec vitest run --root scripts

# Dry-run the preparation script (requires gh CLI with repo auth)
pnpm tsx scripts/publish-release-to-nexus/index.ts \
  --dry-run true --mod-slug site --file-group-id 5293
```

Note: dry runs require `gh` CLI repo auth; without it, `gh release list` fails.

## Advanced: Archive Behavior

The `archive_existing_file` option is `false`. The workflow **replaces the
previous file on the mod page** instead of archiving it. To archive the old
file, contact the Nexus Mods team before running the workflow.
