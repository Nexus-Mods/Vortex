import { getErrorMessageOrDefault } from "@vortex/shared";

import { getApplication } from "@/util/application";

interface IModFileVersionsResult {
  data: {
    versions: IModFileVersion[];
  };
}

interface IModFilesResult {
  data: {
    mod_files: IModFile[];
  };
}

export interface IModFileVersion {
  id: string;
  file: {
    id: string;
    name: string;
  };
  position: string;
  game_scoped_id: string;
  name: string;
  version: string;
  category: string;
  uploaded_at: string;
  is_primary: boolean;
}

export interface IModFile {
  id: string;
  name: string;
  is_active: boolean;
  last_file_updated_at: string;
  versions_count: number;
  archived_count: number;
  removed_count: number;
}

interface V3APIError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

export async function getModFileVersions(
  fileUid: string,
  token: string | undefined,
  signal: AbortController["signal"],
): Promise<IModFileVersion[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Application-Name": "Vortex",
    "Application-Version": getApplication().version,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.nexusmods.com/v3/mod-files/${fileUid}/versions`, {
      method: "GET",
      headers,
      signal,
    });
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Nexus Mods token has expired, please log out and back in.");
      const jsonError: V3APIError = (await res.json()) as V3APIError;
      throw new Error(
        `Version fetch failed: ${jsonError.status ?? res.status} ${jsonError.title ?? res.statusText} :: ${jsonError.detail ?? ""}`,
      );
    }
    const json: IModFileVersionsResult = (await res.json()) as IModFileVersionsResult;
    return json.data.versions;
  } catch (e: unknown) {
    window.api.log("warn", "Failed to fetch mod file versions", getErrorMessageOrDefault(e));
    throw e;
  }
}

export async function getModFiles(
  modUid: string,
  token: string,
  signal: AbortController["signal"],
): Promise<IModFile[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Application-Name": "Vortex",
    "Application-Version": getApplication().version,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`https://api.nexusmods.com/v3/mods/${modUid}/files`, {
      method: "GET",
      headers,
      signal,
    });
    if (!res.ok) {
      if (res.status === 401)
        throw new Error("Nexus Mods token has expired, please log out and back in.");
      const jsonError: V3APIError = (await res.json()) as V3APIError;
      throw new Error(
        `Version fetch failed: ${jsonError.status ?? res.status} ${jsonError.title ?? res.statusText} :: ${jsonError.detail ?? ""}`,
      );
    }
    const json: IModFilesResult = (await res.json()) as IModFilesResult;
    return json.data.mod_files;
  } catch (e: unknown) {
    window.api.log("warn", "Failed to fetch mod file versions", getErrorMessageOrDefault(e));
    throw e;
  }
}
