import { notificationsReducer } from '../src/reducers/notifications';

describe('startNotification', () => {
  const input = { notifications: [] };
  it('appends the notification', () => {
    const notification = { id: '42', message: 'test', type: 'info' };
    const result = notificationsReducer.reducers.ADD_NOTIFICATION(input, notification);
    expect(result.notifications).toContain(notification);
  });

  it('generates an id if required', () => {
    const notification = { message: 'test', type: 'info' };
    const result = notificationsReducer.reducers.ADD_NOTIFICATION(input, notification);
    expect(result.notifications[0].id).not.toBeUndefined();
  });
});

describe('dismissNotification', () => {
  const notification = { id: '42', message: 'test', type: 'info' };
  const input = { notifications: [ notification ] };
  it('removes the notification', () => {
    const result = notificationsReducer.reducers.STOP_NOTIFICATION(input, '42');
    expect(result.notifications.length).toBe(0);
  });

  it('does nothing on an invalid id', () => {
    const result = notificationsReducer.reducers.STOP_NOTIFICATION(input, '43');
    expect(result.notifications).toContain(notification);
  });
});

describe('dismissDialog', () => {
  const dialogA = { id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] };
  const dialogB = { id: 43, type: 'info', title: 'title2', content: { message: 'message2' }, actions: [] };
  const input = { dialogs: [ dialogA, dialogB ] };
  it('dismisses the specified dialog', () => {
    const result = notificationsReducer.reducers.DISMISS_MODAL_DIALOG(input, 42);
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual(dialogB);
  });
});

describe('showDialog', () => {
  const input = { dialogs: [] };
  it('appends a dialog to be shown', () => {
    const result = notificationsReducer.reducers.SHOW_MODAL_DIALOG(input,
                                                                   { id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] });
    expect(result.dialogs.length).toBe(1);
    expect(result.dialogs[0]).toEqual({ id: 42, type: 'info', title: 'title', content: { message: 'message' }, actions: [] });
  });
});
