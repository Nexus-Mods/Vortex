import * as core from "@actions/core";

import { listVersionTags, mergeBase, tagExists } from "./git";
import { type ReleaseClient, fetchReleaseNotes, writeNotesFile } from "./notes";
import { previousReleaseTag } from "./previous-tag";

/**
 * Entry point for mode=prepare: validates the tag, resolves the previous
 * same-channel tag and its fork point as the commit-scan base, and fetches
 * the GitHub release notes for the release action to attach.
 */
export const runPrepare = async (
  client: ReleaseClient,
  owner: string,
  repo: string,
): Promise<void> => {
  const tag = core.getInput("tag", { required: true });
  const prerelease = core.getInput("prerelease") === "true";

  if (!(await tagExists(tag))) {
    throw new Error(`Tag "${tag}" not found`);
  }

  const prevtag = previousReleaseTag(await listVersionTags(), tag, prerelease);
  const base = prevtag === "" ? "" : await mergeBase(prevtag, tag);
  if (prevtag === "") {
    core.info(
      `No previous release found for ${tag} on its channel; the release CLI will use its default scan base`,
    );
  } else {
    core.info(`Previous release on this channel: ${prevtag}; scanning ${base}..${tag}`);
  }

  const notes = await fetchReleaseNotes(client, owner, repo, tag);
  if (notes === "") {
    core.info(`No GitHub release notes found for "${tag}"`);
  }

  core.setOutput("tag", tag);
  core.setOutput("prerelease", String(prerelease));
  core.setOutput("prevtag", prevtag);
  core.setOutput("base", base);
  core.setOutput("notes-file", notes === "" ? "" : writeNotesFile(notes));
};
