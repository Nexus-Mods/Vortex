/* eslint-disable */
export interface IWaitForConditionOptions {
  // Only call the callback if the condition is true
  condition: () => boolean;

  // Do something if the condition is met
  callback: () => void;

  // Whether the app still needs to call the callback
  required?: () => boolean;

  // How long to wait before checking the condition again
  timeoutMS?: number;
}

export const waitForCondition = (opts: IWaitForConditionOptions) => {
  const { condition, callback, required = () => true, timeoutMS = 1000 } = opts;
  const waitForCondition = new Promise<void>((resolve) => {
    const checkCondition = () => {
      if (!required() || condition()) {
        resolve();
      } else {
        setTimeout(checkCondition, timeoutMS);
      }
    };
    checkCondition();
  });

  waitForCondition.then(() => {
    if (typeof callback === 'function' && required()) {
      callback();
    }
  });
};
