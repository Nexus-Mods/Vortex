import * as React from "react";
import { tooltip, types } from "vortex-api";
import Timer from "./Timer";

export interface ISlideshowControlsProps {
  t: types.TFunction;
  numItems: number;
  autoProgressTimeMS?: number;

  onChangeItem: (item: number) => void;
}

function SlideshowControls(props: ISlideshowControlsProps) {
  const { t, autoProgressTimeMS, numItems, onChangeItem } = props;

  const [paused, setPaused] = React.useState(false);
  const [idx, setIdx] = React.useState(0);
  const [lastChange, setLastChange] = React.useState(0);
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // the callbacks support wrap-around even though the ui does not
  const next = React.useCallback(() => {
    if (!isMounted.current) {
      // next may be called asynchronously and there is no good way of canceling it on unmount
      return;
    }

    let value: number;
    setIdx((oldValue) => {
      value = (oldValue + 1) % numItems;
      return value;
    });
    setLastChange(Date.now());
    onChangeItem(value);
  }, [numItems, onChangeItem, setIdx, setLastChange]);

  const prev = React.useCallback(() => {
    let value: number;
    setIdx((oldValue) => {
      value = oldValue > 0 ? oldValue - 1 : numItems - 1;
      return value;
    });
    setLastChange(Date.now());
    onChangeItem(value);
  }, [numItems, onChangeItem, setIdx, setLastChange]);

  const togglePause = React.useCallback(() => {
    setPaused((old) => !old);
    // setLastChange(Date.now());
  }, [setPaused]);

  return (
    <div className="slideshow-controls">
      <tooltip.IconButton
        icon="collection-previous"
        tooltip={t("Show previous mod")}
        disabled={idx === 0}
        onClick={prev}
      />
      {t("{{pos}} of {{count}}", {
        replace: { pos: idx + 1, count: numItems },
      })}
      <tooltip.IconButton
        icon="collection-next"
        tooltip={t("Show next mod")}
        disabled={idx === numItems - 1}
        onClick={next}
      />

      {autoProgressTimeMS !== undefined ? (
        <tooltip.IconButton
          className="button-with-timer"
          icon={paused ? "resume" : "pause"}
          tooltip={t("Start/Pause automatic advancement")}
          onClick={togglePause}
        >
          <Timer
            className="slideshow-timer"
            started={lastChange}
            paused={paused}
            duration={autoProgressTimeMS}
            onTrigger={next}
          />
        </tooltip.IconButton>
      ) : null}
    </div>
  );
}

export default SlideshowControls;
