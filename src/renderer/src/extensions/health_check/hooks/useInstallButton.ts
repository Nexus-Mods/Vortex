import { useState } from "react";

/**
 * Loading state for an install/download button. The action resolves to whether a
 * real download/install ran; loading clears only on failure (or `skip`) — on
 * success the card unmounts as the requirement clears, so it's left set.
 */
export const useInstallButton = (action: () => Promise<boolean>, skip = false) => {
  const [isLoading, setIsLoading] = useState(false);

  const onClick = () => {
    if (skip) {
      void action();
      return;
    }
    setIsLoading(true);
    action().then(
      (ok) => {
        if (!ok) {
          setIsLoading(false);
        }
      },
      () => setIsLoading(false),
    );
  };

  return { isLoading, onClick };
};
