import {ipcRenderer} from 'electron';

setTimeout(() => {
  document.getElementById('splash').setAttribute('style', 'opacity: 1');
}, 100);

ipcRenderer.on('fade-out', () => {
  document.getElementById('splash').setAttribute('style', 'opacity: 0');
});
