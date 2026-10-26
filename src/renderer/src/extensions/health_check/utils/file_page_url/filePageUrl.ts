/**
 * The file's page on the Nexus website (the specific file, not the mod), where free users
 * pick the slow or fast download.
 *
 * `file_id` can reach hidden mods and archived files. An alternative form is
 *   `${modPageUrl}?tab=files&show_file=${fileId}`
 * but `show_file` cannot open hidden mods or archived files (it could be updated to).
 */
export function filePageUrl(modPageUrl: string, fileId: number): string {
  return `${modPageUrl}?tab=files&file_id=${fileId}&nmm=1`;
}

/** The mod's page on the Nexus website for a Nexus game domain and mod id. */
export function nexusModPageUrl(domain: string, modId: number): string {
  return `https://www.nexusmods.com/${domain}/mods/${modId}`;
}
