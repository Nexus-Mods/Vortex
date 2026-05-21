/**
 * Per-game test harness descriptor. Consumed by `@vortex/game-extension-test`.
 *
 * The shape is mirrored from `IGameExtensionTestDescriptor` in
 * `@vortex/game-extension-test` to avoid the import dependency cycle during
 * normalization. Once the harness package is a devDep, the import can be
 * restored.
 *
 * `gameId` is the primary registered id; the installer's testMod accepts
 * `xcom2` and `xcom2-wotc`, and WOTC uses `nexusPageId: "xcom2"` so a single
 * descriptor covers fixtures for both.
 *
 * The `skipHeuristics` list captures upload shapes Vortex shouldn't try to
 * install automatically (source projects, instructions-only uploads, external
 * tools, etc.). Each predicate is evaluated against the archive's flat file
 * manifest before the installer chain runs; a match reports the fixture as
 * skipped instead of letting it surface as an installer rejection.
 */
/**
 * "Documentation" extensions — text instructions plus image/screenshot
 * formats. An archive whose data is *entirely* these is an upload of human-
 * readable material (readmes, wallpapers, modding guides, screenshot packs)
 * with no installable game content. Vortex has nothing to do with it.
 *
 * Image extensions are included here, not in their own heuristic, because
 * image-only archives (wallpapers) and mixed doc+image archives (modding
 * guides bundling PDFs with screenshots) collapse to the same conclusion:
 * skip.
 */
const DOC_EXT_RE = /\.(txt|pdf|md|docx|rtf|html|htm|jpe?g|png|gif|bmp|webp|svg|tiff?)$/i;

export const testDescriptor = {
  gameId: "xcom2",
  nexusGameDomain: "xcom2",
  fixtures: {
    mostPopular: 0,
    mostRecent: 0,
    oldest: 0,
    allCollections: false,
    all: true,
  } as const,
  syntheticContent: {},
  skipHeuristics: [
    {
      reason: "ModBuddy source project — needs compilation into a .XComMod first",
      // .uc source is commonly bundled alongside the compiled output in
      // legitimate mod archives (the canonical installer picks them up via
      // .XComMod). Only skip when there's no .XComMod present, i.e. the
      // upload is genuinely a source-only project.
      matches: (files: string[]): boolean => {
        const hasSource = files.some((f) => /\.(uc|x2proj)$/i.test(f));
        const hasXComMod = files.some((f) => /\.XComMod$/i.test(f));
        return hasSource && !hasXComMod;
      },
    },
    {
      reason: "nested archive — user must extract before installing",
      matches: (files: string[]): boolean => files.some((f) => /\.(7z|rar|zip)$/i.test(f)),
    },
    {
      reason:
        "documentation-only upload (readmes/PDFs/screenshots/wallpapers, no installable content)",
      // Also covers empty manifests — a CDN content-preview that lists no
      // files means the harness can't see installable content even if the
      // archive bytes contain some. Skip rather than fail.
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return data.length === 0 || data.every((f) => DOC_EXT_RE.test(f));
      },
    },
    {
      reason: "ReShade / shader injector (graphics overlay, not an XCOM 2 mod)",
      // Three ways to recognise the family:
      //  - any shader source file (.fx / .fxh / .hlsl) → ReShade preset
      //  - any .cfg or .undef file. XCOM 2 itself uses .ini for config and
      //    has no native .undef, so these extensions in this game's fixture
      //    set are exclusively ReShade/SweetFX preset files (Real Vision
      //    SSAO Boost ships SSAO.h + McFX.cfg with no ReShade/ wrapper;
      //    X-Com2.cfg is a bare SweetFX drop).
      //  - any path component named ReShade/ or SweetFX/, catching
      //    wrapper-folder uploads like Real Vision ReShade No Blur's
      //    ReShade/Common.cfg layout.
      matches: (files: string[]): boolean =>
        files.some(
          (f) =>
            /\.(fx|fxh|hlsl|cfg|undef)$/i.test(f) || /(^|[\\/])(ReShade|SweetFX)([\\/.])/i.test(f),
        ),
    },
    {
      reason: "standalone Windows tool (external utility, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return (
          data.length > 0 &&
          data.every((f) => /\.(exe|dll|config|manifest|application|ico|ctk)$/i.test(f))
        );
      },
    },
    {
      reason: "Access database tool (design utility, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.some((f) => /\.accdb$/i.test(f)),
    },
    {
      reason: "controller profile (.xpadderprofile, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.some((f) => /\.xpadderprofile$/i.test(f)),
    },
    {
      reason: "movies/intro replacement (.bk2 only, deployed via a different path)",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return data.length > 0 && data.every((f) => /\.bk2$/i.test(f) || DOC_EXT_RE.test(f));
      },
    },
    {
      reason: "cheat-engine table (.ct, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.length === 1 && /\.ct$/i.test(files[0]!),
    },
    {
      reason:
        "raw cooked content (.upk / .u with no .XComMod) — replaces stock packages, " +
        "not safe to auto-install",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        const hasCooked = data.some((f) => /\.(upk|u)$/i.test(f));
        const hasXComMod = data.some((f) => /\.XComMod$/i.test(f));
        return hasCooked && !hasXComMod;
      },
    },
    {
      reason:
        "voice pack (raw .wav/.ogg samples) — needs the Voice Pack Toolkit mod to load " +
        "them at runtime, not installable standalone",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        if (data.length === 0) return false;
        return data.every((f) => /\.(wav|ogg|mp3|wem)$/i.test(f) || DOC_EXT_RE.test(f));
      },
    },
  ],
};
