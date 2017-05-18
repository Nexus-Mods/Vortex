import * as Promise from 'bluebird';

function step(startTime: number, endTime: number, time: number) {
  if (time <= startTime) {
    return 0;
  }
  if (time >= endTime) {
    return 1;
  }
  const x = (time - startTime) / (endTime - startTime);
  return x * x * (3 - 2 * x);
}

function smoothScroll(element: HTMLElement, targetPos: number, duration: number) {
  targetPos = Math.round(targetPos);
  duration = Math.max(Math.round(duration), 0);

  const startTime = Date.now();
  const endTime = startTime + duration;

  const startPos = element.scrollTop;
  const distance = targetPos - startPos;

  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      const now = Date.now();
      const percent = step(startTime, endTime, now);
      const newPos = Math.round(startPos + (distance * percent));
      element.scrollTop = newPos;

      if ((now >= endTime) || (element.scrollTop !== newPos)) {
        // failed to scroll all the way to the destination pos,
        // probably hit bounds
        return resolve();
      }

      setTimeout(tick, 16);
    };

    setImmediate(tick);
  });
}

export default smoothScroll;
