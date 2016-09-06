/**
 * Development Tools that can be integrated into the main application UI. Should
 * not be referenced in production
 */

import * as React from 'react';
import { createDevTools } from 'redux-devtools';
import LogMonitor from 'redux-devtools-log-monitor';

const DevTools = createDevTools(
  <LogMonitor />
);

export = DevTools;
