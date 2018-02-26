import safeCreateAction from '../../actions/safeCreateAction';

export const setLayout = safeCreateAction('SET_LAYOUT', layout => layout);

export const setDashletEnabled = safeCreateAction('SET_WIDGET_ENABLED',
  (widgetId: string, enabled: boolean) => ({ widgetId, enabled }));
