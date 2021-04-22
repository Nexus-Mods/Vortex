import * as _ from 'lodash';
import * as React from 'react';

interface IExtraImageProps<T> extends React.ImgHTMLAttributes<T> {
  srcs: string[];
  circle?: boolean;
}

export type IImageProps = React.DetailedHTMLProps<
  IExtraImageProps<HTMLImageElement>,
  HTMLImageElement
>;

/**
 * image component that supports alternative images, using the first that renders
 * successfully
 */
function Image(props: IImageProps): JSX.Element {
  const { className, circle, srcs } = props;

  const [srcIdx, setSourceIndex] = React.useState(0);
  const errorCB = React.useCallback(() => {
    if (srcIdx + 1 < srcs.length) {
      setSourceIndex(srcIdx + 1);
    }
  }, []);

  const classes: string[] = [];
  if (circle === true) {
    classes.push('img-circle');
  }
  if (className !== undefined) {
    classes.push(className);
  }

  return (
    <img
      {..._.omit(props, ['srcs', 'circle'])}
      className={classes.join(' ')}
      src={srcs[srcIdx]}
      onError={errorCB}
    />
  );
}

export default Image;
