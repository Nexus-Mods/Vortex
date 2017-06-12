import { IFeedbackFile } from './types/IFeedbackFile';

import { types } from 'nmm-api';

export const FILE_NAME: types.ITableAttribute = {
  id: 'filename',
  name: 'filename',
  description: 'Name of the feedback file',
  icon: 'id-badge',
  calc: (feedbackFile: IFeedbackFile) => feedbackFile.filename,
  placement: 'table',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: true,
  edit: {},
};

export const SIZE: types.ITableAttribute = {
  id: 'size',
  name: 'size',
  description: 'Size of the feedback file',
  icon: 'id-badge',
  calc: (feedbackFile: IFeedbackFile) => feedbackFile.size,
  placement: 'table',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: true,
  edit: {},
};

export const TYPE: types.ITableAttribute = {
  id: 'type',
  name: 'type',
  description: 'Type of the feedback file',
  icon: 'id-badge',
  calc: (feedbackFile: IFeedbackFile) => feedbackFile.type,
  placement: 'table',
  isToggleable: true,
  isSortable: true,
  isDefaultVisible: true,
  edit: {},
};
