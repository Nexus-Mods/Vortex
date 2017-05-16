function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'advanced':
      return t(
          'In advanced mode Vortex will show a couple of features ' +
          'that will be useful to experienced users but would either ' +
          'be confusing to new users or could be used to break things ' +
          'if used incorrectly or accidentally. Hence they are ' +
          'disabled by default.');
    default:
      return undefined;
  }
}

export default getText;
