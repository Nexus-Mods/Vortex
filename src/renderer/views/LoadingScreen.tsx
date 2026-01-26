import ProgressBar from "../controls/ProgressBar";
import type ExtensionManager from "../../util/ExtensionManager";

import * as React from "react";

export interface ILoadingScreenProps {
  extensions: ExtensionManager;
}

function readable(input: string): string {
  if (input === undefined) {
    return "Done";
  }
  return input
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function LoadingScreen(props: ILoadingScreenProps): React.JSX.Element {
  const { extensions } = props;

  const [currentlyLoading, setCurrentlyLoading] = React.useState("");
  const [loaded, setLoaded] = React.useState(0);
  const totalExtensions = React.useMemo(() => extensions.numOnce, [extensions]);

  React.useEffect(() => {
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
        now={loaded}
        max={totalExtensions}
      />
    </div>
  );
}

export default LoadingScreen;
