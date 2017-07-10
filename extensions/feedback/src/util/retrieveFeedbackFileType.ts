export function retrieveFeedbackFileType(type: string, t: I18next.TranslationFunction) {

  switch (type.toLowerCase()) {
    case '.jpg':
    case '.bmp':
    case '.png':
    case '.gif':
      return t('Screenshot');
    case '.txt':
    case '.doc':
    case '.pdf':
    case '.rtf':
      return t('Document');
    default: return type;
  }
}
