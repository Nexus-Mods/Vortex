import React, { useEffect, useMemo, useState, type FC } from "react";

import type ExtensionManager from "../../util/ExtensionManager";

import ProgressBar from "../controls/ProgressBar";

export interface ILoadingScreenProps {
  extensions: ExtensionManager;
}

const readable = (input: string): string => {
  if (input === undefined) {
    return "Done";
  }
  return input
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const LoadingScreen: FC<ILoadingScreenProps> = (props) => {
  const { extensions } = props;

  const [currentlyLoading, setCurrentlyLoading] = useState("");
  const [loaded, setLoaded] = useState(0);
  const totalExtensions = useMemo(() => extensions.numOnce, [extensions]);

  useEffect(() => {
    extensions.onLoadingExtension((name: string, idx: number) => {
      setCurrentlyLoading(name);
      setLoaded(idx);
    });
  }, [extensions]);

  return (
    <div id="loading-screen">
      <ProgressBar
        labelLeft="Loading Extensions"
        labelRight={readable(currentlyLoading)}
        max={totalExtensions}
        now={loaded}
      />
    </div>
  );
};

export default LoadingScreen;
