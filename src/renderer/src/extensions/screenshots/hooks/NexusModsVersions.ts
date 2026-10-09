/* eslint-disable @eslint-react/set-state-in-effect */
import { useEffect, useState } from "react";

import { getAccessToken } from "@/extensions/nexus_integration/util/oauthSession";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IModFileVersion, IModFile } from "../util/getModFileVersions";
import { getModFiles, getModFileVersions } from "../util/getModFileVersions";

export default function useNexusModsVersions(uid: string, api: IExtensionApi) {
  const [files, setFiles] = useState<IModFile[]>();
  const [versions, setVersions] = useState<IModFileVersion[]>();
  const [selectedFile, setSelectedFile] = useState<IModFile>();
  const [selectedVersion, setSelectedVersion] = useState<IModFileVersion>();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setIsError(false);
    void (async () => {
      try {
        const token = await getAccessToken(api);
        const f = await getModFiles(uid, token, controller.signal);
        if (!controller.signal.aborted) {
          setFiles(f);
          setSelectedFile(f[0]);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e as Error);
          setIsError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
  }, [uid, api]);

  useEffect(() => {
    console.log("Versions update", selectedFile);
    if (!selectedFile) return;
    const controller = new AbortController();
    setIsLoading(true);
    setIsError(false);
    void (async () => {
      try {
        const token = await getAccessToken(api);
        const v = await getModFileVersions(selectedFile.id, token, controller.signal);
        if (!controller.signal.aborted) {
          setVersions(v);
          setSelectedVersion(v[0]);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e as Error);
          setIsError(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
  }, [selectedFile, api]);

  return {
    files,
    versions,
    selectedFile,
    selectedVersion,
    isLoading,
    isError,
    error,
    setSelectedFile,
    setSelectedVersion,
  };
}
