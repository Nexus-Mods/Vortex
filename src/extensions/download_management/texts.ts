import * as I18next from 'i18next';

function getText(id: string, t: I18next.TranslationFunction) {
  switch (id) {
    case 'download-threads':
      return t(
        'Set the number of parallel download requests to the server\n\n'
        + 'If (and only if!) your ISP, the download server or a router in between '
        + 'caps the speed per download request it can be faster to '
        + 'do multiple requests at once (either to different files or to '
        + 'multiple chunks of the same file).\n\n'
        + 'Vortex supports loading files in chunks so even if '
        + 'you increase the number of threads that doesn\'t mean more than one file '
        + 'gets loaded, we try to get individual files as fast as possible so '
        + 'you can start installing.\n\n'
        + 'If you find the number of threads has no effect on your download speed '
        + 'that probably means your download requests are not limited or you\'re not '
        + 'reaching the cap for other reasons. In that case, please set the number of '
        + 'threads low because that puts less stress on the servers.');
    default: return undefined;
  }
}

export default getText;
