import * as React from 'react';

interface ICoord {
  x: number;
  y: number;
}

interface ILineProps {
  className: string;
  source: ICoord;
  target: ICoord;
  curved: boolean;
}

const Line = (props: ILineProps) => {
  const { className, curved, source, target } = props;

  const top = Math.min(target.y, source.y) - 2;
  const left = Math.min(target.x, source.x);

  const boxWidth = Math.abs(target.x - source.x) + 80;
  const boxHeight = Math.abs(target.y - source.y) + 4;

  const path = curved
   ? `M ${source.x - left} ${source.y - top}
  Q ${boxWidth} ${boxHeight / 2} ${target.x - left} ${target.y - top}`
   : `M ${source.x - left} ${source.y - top} L ${target.x - left} ${target.y - top}`;

  return (
    <svg
      width={boxWidth}
      height={boxHeight}
      style={{ position: 'fixed', top, left, pointerEvents: 'none' }}
    >
      <path className={className} d={path} fill='none' />
    </svg>
  );
};

export default Line;
