import {ipcRenderer} from 'electron';

ipcRenderer.on('fade-out', () => {
  document.getElementById('splash').setAttribute('transition', 'opacity 500ms ease-in-out');
  document.getElementById('splash').setAttribute('style', 'opacity: 0');
});

const url = new URL(window.location.href);
if (url.searchParams.get('disableGPU') === '1') {
  document.getElementById('bg').style.backgroundColor = '#d78f46';
}
