/**
 * Posts a release announcement card to a Discord webhook, using Discord's
 * Components V2 layout. Entry point of the discord-release action; also runs
 * locally:
 *
 *   node --env-file=.env .github/actions/discord-release/index.mjs [tag] [--dry-run]
 *
 * Without a tag it announces the latest stable release. --dry-run prints the
 * payload instead of posting it. DISCORD_WEBHOOK_URL is required unless
 * --dry-run; GITHUB_TOKEN is optional and only raises the API rate limit.
 */

const REPO = "Nexus-Mods/Vortex";
const LOGO = `https://raw.githubusercontent.com/${REPO}/master/assets/images/vortex.png`;
const NEXUS_PAGE = "https://www.nexusmods.com/vortex";
const COLOR_STABLE = 0xd98f40;
const COLOR_BETA = 0x5865f2;
// Components V2 caps the summed text of all text displays at 4000 chars.
const NOTES_LIMIT = 3500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tag = args.find((a) => !a.startsWith("--"));

const headers = { Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const releaseUrl = tag
  ? `https://api.github.com/repos/${REPO}/releases/tags/${tag}`
  : `https://api.github.com/repos/${REPO}/releases/latest`;
const res = await fetch(releaseUrl, { headers });
if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
const release = await res.json();

const isBeta = release.prerelease;
const version = release.tag_name.replace(/^v/, "");
const date = new Date(release.published_at).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// Minor releases carry written release notes ending in a "Spot a Bug" section
// that duplicates the card's footer, so cut there.
// A blank line before a heading stacks with the heading's own margin in Discord.
let notes = (release.body ?? "").replace(/\r\n/g, "\n").replace(/^#+ .*Spot a Bug[\s\S]*/im, "");

// Discord renders neither HTML nor inline media, so images and videos move to a
// gallery. GitHub writes an uploaded video as a bare attachment URL on its own line.
const media = [];
notes = notes.replace(
  /<(?:img|video)\b[^>]*\bsrc="([^"]+)"[^>]*>(?:<\/video>)?|!\[[^\]]*\]\(([^)\s]+)[^)]*\)|^[ \t]*(https:\/\/github\.com\/user-attachments\/assets\/\S+|https?:\/\/\S+\.(?:mp4|webm|mov))[ \t]*$/gm,
  (_, tag, md, bare) => {
    media.push(tag ?? md ?? bare);
    return "";
  },
);

notes = notes
  .replace(/\n{3,}/g, "\n\n")
  .replace(/\n+(?=#)/g, "\n")
  .trim();
if (notes.length > NOTES_LIMIT) {
  notes =
    notes.slice(0, notes.lastIndexOf("\n", NOTES_LIMIT)) + "\n\n*…and more in the full changelog.*";
}

const [major, minor] = version.split(".");
const releaseBranch = `release/v${major}.${minor}`;

const installer = release.assets.find((a) => /^vortex-setup-.*\.exe$/.test(a.name));

const intro = isBeta
  ? "A new beta is out. Opt in under **Settings → Vortex → Update Channel**."
  : `A new version of Vortex is out. Vortex updates itself, or grab it from [Nexus Mods](${NEXUS_PAGE}).`;

const buttons = [
  isBeta
    ? installer && {
        type: 2,
        style: 5,
        label: "Download installer",
        url: installer.browser_download_url,
      }
    : { type: 2, style: 5, label: "Download on Nexus Mods", url: NEXUS_PAGE },
  {
    type: 2,
    style: 5,
    label: "Full changelog",
    url: `https://github.com/${REPO}/blob/${releaseBranch}/CHANGELOG.md`,
  },
].filter(Boolean);

const title = {
  type: 10,
  content: `# Vortex ${version}\n-# ${isBeta ? "Beta" : "Stable"} release · ${date}\n${intro}`,
};
const header = { type: 9, components: [title], accessory: { type: 11, media: { url: LOGO } } };

// An invite rather than a channel mention, which breaks when followed into other servers.
const footer = [
  "-# 🐛 **Spot a bug?** [Here's how to report it](https://modding.wiki/en/bug-reports).",
  "-# 💬 **Questions or feedback?** Come chat in the Vortex channel on the [Nexus Mods Discord](https://discord.gg/nexusmods).",
].join("\n");

const payload = {
  username: "Vortex",
  avatar_url: LOGO,
  flags: 1 << 15,
  allowed_mentions: { parse: [] },
  components: [
    {
      type: 17,
      accent_color: isBeta ? COLOR_BETA : COLOR_STABLE,
      components: [
        header,
        { type: 14, divider: true, spacing: 1 },
        { type: 10, content: notes || "*No release notes.*" },
        ...(media.length
          ? [{ type: 12, items: media.slice(0, 10).map((url) => ({ media: { url } })) }]
          : []),
        { type: 14, divider: true, spacing: 1 },
        { type: 1, components: buttons },
        { type: 10, content: footer },
      ],
    },
  ],
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) throw new Error("DISCORD_WEBHOOK_URL is not set");

  const post = await fetch(`${webhook}?with_components=true&wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!post.ok) throw new Error(`Discord ${post.status}: ${await post.text()}`);
  console.log(`Posted ${release.tag_name} (message ${(await post.json()).id})`);
}
