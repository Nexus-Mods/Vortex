import { notificationsReducer } from '../src/reducers/notifications';

describe('startNotification', () => {
  let input = { notifications: [] };
  it('appends the notification', () => {
    let notification = { id: '42', message: 'test', type: 'info' };
    let result = notificationsReducer.reducers.ADD_NOTIFICATION(input, notification);
    expect(result.notifications).toContain(notification);
  });

  it('generates an id if required', () => {
    let notification = { message: 'test', type: 'info' };
    let result = notificationsReducer.reducers.ADD_NOTIFICATION(input, notification);
    expect(result.notifications[0].id).not.toBeUndefined();
  });
});

describe('dismissNotification', () => {
  let notification = { id: '42', message: 'test', type: 'info' };
  let input = { notifications: [ notification ] };
  it('removes the notification', () => {
    let result = notificationsReducer.reducers.STOP_NOTIFICATION(input, '42');
    expect(result.notifications.length).toBe(0);
  });

  it('does nothing on an invalid id', () => {
    let result = notificationsReducer.reducers.STOP_NOTIFICATION(input, '43');
    expect(result.notifications).toContain(notification);
  });
});

describe('dismissDialog', () => {
  let dialogA = { id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] };
  let dialogB = { id: 43, type: 'info', title: 'title2', content: { message: 'message2' }, actions: [] };
  let input = { dialogs: [ dialogA, dialogB ] };
  it('dismisses the specified dialog', () => {
    let result = notificationsReducer.reducers.DISMISS_MODAL_DIALOG(input, 42);
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual(dialogB);
  });
});

describe('showDialog', () => {
  let input = { dialogs: [] };
  it('appends a dialog to be shown', () => {
    let result = notificationsReducer.reducers.SHOW_MODAL_DIALOG(input,
      { id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] });
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual({ id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] });
  });
});
