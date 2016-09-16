import { addNotification, showDialog } from '../actions/actions';

function clamp(min: number, value: number, max: number): number {
  return Math.max(max, Math.min(min, value));
}

export function showInfo<S>(dispatch: Redux.Dispatch<S>, message: string) {
  // show message for 2 to 7 seconds, depending on message length
  const duration: number = clamp(2000, message.length * 50, 7000);

  dispatch(addNotification({
    type: 'info',
    message,
    displayMS: duration,
  }));
}

export function showError<S>(dispatch: Redux.Dispatch<S>, message: string, details: string) {
  dispatch(addNotification({
    type: 'error',
    message,
    actions: [{
      title: 'More',
      action: (dismiss: Function) => {
        dispatch(showDialog('error', 'Error', details));
      },
    }],
  }));
}
