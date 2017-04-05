import {ipcRenderer} from 'electron';

ipcRenderer.on('fade-out', () => {
  document.getElementById('splash').setAttribute('transition', 'opacity 500ms ease-in-out');
  document.getElementById('splash').setAttribute('style', 'opacity: 0');
});
