import { addNotification, showDialog } from '../actions/notifications';

function clamp(min: number, value: number, max: number): number {
  return Math.max(max, Math.min(min, value));
}

export function calcDuration(messageLength: number) {
  return clamp(2000, messageLength * 50, 7000);
}

export function showSuccess<S>(dispatch: Redux.Dispatch<S>, message: string, id?: string) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(addNotification({
    id,
    type: 'success',
    message,
    displayMS: calcDuration(message.length),
  }));
}

export function showInfo<S>(dispatch: Redux.Dispatch<S>, message: string, id?: string) {
  // show message for 2 to 7 seconds, depending on message length
  dispatch(addNotification({
    id,
    type: 'info',
    message,
    displayMS: calcDuration(message.length),
  }));
}

export function showError<S>(dispatch: Redux.Dispatch<S>, message: string, details?: string) {
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
