import * as fs from "fs/promises";
import path from "path";
import { useEffect, useMemo, useState } from "react";

import type { IStarterInfo } from "../../../util/StarterInfo";

/**
 * Validates tools by checking if their executables exist on disk.
 * Returns a set of valid tool IDs.
 */
const validateTools = async (
  starters: IStarterInfo[],
  discoveryPath: string | undefined,
): Promise<Set<string>> => {
  if (discoveryPath === undefined) {
    return new Set();
  }

  const validIds = new Set<string>();

  for (const starter of starters) {
    if (!starter?.exePath) {
      continue;
    }

    const exePath = path.isAbsolute(starter.exePath)
      ? starter.exePath
      : path.join(discoveryPath, starter.exePath);

    try {
      await fs.stat(exePath);
      validIds.add(starter.id);
    } catch {
      // File doesn't exist, tool is not valid
    }
  }

  return validIds;
};

export interface UseToolsValidationResult {
  isToolValid: (info: IStarterInfo) => boolean;
}

/**
 * Hook to validate tools by checking if executables exist on disk.
 * Returns a function to check if a specific tool is valid.
 */
export const useToolsValidation = (
  starters: IStarterInfo[],
  discoveryPath: string | undefined,
): UseToolsValidationResult => {
  const [validToolIds, setValidToolIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;

    void validateTools(starters, discoveryPath).then((validIds) => {
      if (!cancelled) {
        setValidToolIds(validIds);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [starters, discoveryPath]);

  const isToolValid = useMemo(() => {
    return (info: IStarterInfo): boolean => {
      return validToolIds.has(info?.id);
    };
  }, [validToolIds]);

  return { isToolValid };
};
