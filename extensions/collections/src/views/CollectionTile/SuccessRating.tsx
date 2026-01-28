import * as React from "react";
import { TFunction } from "react-i18next";
import { Icon, log } from "vortex-api";
import InfoCache from "../../util/InfoCache";

export interface ISuccessRatingProps {
  t: TFunction;
  infoCache: InfoCache;
  collectionSlug: string;
  revisionNumber: number;
  revisionId: number;
}

export function SuccessRating(props: ISuccessRatingProps) {
  const { t, collectionSlug, infoCache, revisionNumber, revisionId } = props;

  const [rating, setRating] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      try {
        const rev = await infoCache.getRevisionInfo(
          revisionId,
          collectionSlug,
          revisionNumber,
        );
        if ((rev?.rating?.total ?? 0) < 3) {
          setRating(undefined);
        } else {
          setRating(rev.rating.average);
        }
      } catch (err) {
        log("error", "failed to get remote info for revision", {
          revisionId,
          collectionSlug,
          revisionNumber,
          error: err.message,
        });
      }
    })();
  }, [revisionId]);

  const classes = ["collection-success-indicator"];

  if (rating === undefined) {
    classes.push("success-rating-insufficient");
  } else if (rating < 50) {
    classes.push("success-rating-bad");
  } else if (rating < 75) {
    classes.push("success-rating-dubious");
  } else {
    classes.push("success-rating-good");
  }

  return (
    <div className={classes.join(" ")}>
      <Icon name="health" />
      {rating === undefined
        ? t("Awaiting")
        : t("{{rating}}%", { replace: { rating } })}
    </div>
  );
}
