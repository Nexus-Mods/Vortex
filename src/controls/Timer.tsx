import * as React from 'react';

export interface ITimerProps {
  className?: string;
  started: number;
  paused?: boolean;
  duration: number;
  onTrigger?: () => void;
}

// to make the keyframes simpler, I want the circumference (in svg units) to be 100
// so the animation goes from 0 to 100
const circumference = 100;

// everything else gets deduced from that, circumference = 2 * pi * radius
// so radius = circumference / (2 * pi)
const radius = circumference / (2 * Math.PI);
const stroke = Math.ceil(radius / 6);

const width = radius * 2 + stroke;
const center = width / 2;

function Timer(props: ITimerProps) {
  const { className, duration, onTrigger, paused, started } = props;

  const [timer, setTimer] = React.useState(null);
  const [active, setActive] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(null);

  React.useEffect(() => {
    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, []);

  React.useEffect(() => {
    // reset the animation if a new started time is set
    setActive(false);
    setElapsed(null);
    setTimeout(() => {
      setActive(true);
    }, 10);
  }, [setActive, setElapsed, started]);

  React.useEffect(() => {
    // if pausing, unpausing or restarting the timer we have to (re-)queue the
    // trigger
    if (timer !== null) {
      clearTimeout(timer);
    }
    if (paused) {
      setElapsed(Date.now() - started);
    } else {
      let remaining = duration;
      if (elapsed !== null) {
        // after resume from pause
        remaining = duration - elapsed;
        setElapsed(null);
      } else {
        remaining = (started + duration) - Date.now();
      }

      if (remaining < 0) {
        remaining = duration;
      }
      if (onTrigger !== undefined) {
        setTimer(setTimeout(() => {
          onTrigger();
        }, remaining));
      }
    }
  }, [setTimer, setElapsed, paused, started]);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${width}`}
      style={{ strokeWidth: stroke }}
    >
      <circle
        className='timer-background'
        fill='none'
        cx={center}
        cy={center}
        r={radius}
      />
      <circle
        className='timer-circle'
        style={{
          animationDuration: duration.toString() + 'ms',
          animationDirection: 'reverse',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
          animationPlayState: paused ? 'paused' : 'running',
          transform: 'rotate(-90deg)',
          transformOrigin: 'center',
          display: active ? undefined : 'none',
        }}
        strokeDasharray={`${circumference},${circumference}`}
        strokeLinecap='round'
        fill='none'
        cx={center}
        cy={center}
        r={radius}
      />
    </svg>
  );
}

export default Timer;
