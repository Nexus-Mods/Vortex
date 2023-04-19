const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const format = require('string-template');

let dropzone = document.querySelector('#dropzone');
let icons = document.querySelector('#icons');

const basePath = path.resolve(__dirname, '..', '..', 'icons');
const configPath = path.resolve(__dirname, '..', 'iconconfig.json');

const locations = [
  '{nucleo}/arrows/{nucleo_simple}_',
  '{nucleo}/ui/{nucleo_simple}_',
  '{nucleo}/user interface/{nucleo_simple}_',
  '{nucleo}/animals-nature/{nucleo_simple}_',
  '{nucleo}/business-finance/{nucleo_simple}_',
  '{nucleo}/clothes-accessories/{nucleo_simple}_',
  '{nucleo}/design-development/{nucleo_simple}_',
  '{nucleo}/emoticons/{nucleo_simple}_',
  '{nucleo}/energy-environment/{nucleo_simple}_',
  '{nucleo}/files-folders/{nucleo_simple}_',
  '{nucleo}/files-folders/32px_',
  '{nucleo}/food/{nucleo_simple}_',
  '{nucleo}/furniture/{nucleo_simple}_',
  '{nucleo}/healthcare-medical/{nucleo_simple}_',
  '{nucleo}/holidays/{nucleo_simple}_',
  '{nucleo}/loaders/{nucleo_simple}_',
  '{nucleo}/maps-location/{nucleo_simple}_',
  '{nucleo}/multimedia/{nucleo_simple}_',
  '{nucleo}/objects/{nucleo_simple}_',
  '{nucleo}/school-education/{nucleo_simple}_',
  '{nucleo}/shopping/{nucleo_simple}_',
  '{nucleo}/social media/{nucleo_simple}_',
  '{nucleo}/sport/{nucleo_simple}_',
  '{nucleo}/technology/{nucleo_simple}_',
  '{nucleo}/text editing/{nucleo_simple}_',
  '{nucleo}/touch gestures/{nucleo_simple}_',
  '{nucleo}/transportation/{nucleo_simple}_',
  '{nucleo}/travel/{nucleo_simple}_',
  '{nucleo}/users/{nucleo_simple}_',
  '{nucleo}/weather/{nucleo_simple}_',
  'Nucleo_Outline/interactive icons/32px_',
  '{fa}/',
  '{material_design}/',
];

let config;

function refreshIcons() {
  return fs.readFile(configPath, (err, data) => {
    config = JSON.parse(data.toString());

    while (icons.hasChildNodes()) {
      icons.removeChild(icons.lastChild);
    }

    Object.keys(config.icons).forEach(icon => {
      const newEntry = document.createElement('ul');
      const iconPath = config.icons[icon].path || config.icons[icon];
      newEntry.innerText = `${icon} = ${iconPath}`;
      icons.appendChild(newEntry);
    });
  });
}

function saveChanges() {
  fs.writeFile(configPath, JSON.stringify(config, undefined, 2))
  .then(() => refreshIcons())
  .catch(err => console.error('failed to write', err));
}

function sanitizeName(name) {
  name = path.basename(name, path.extname(name));
  return name.replace(/-[0-9]+$/, '');
}

function addFile(file) {
  let found = false;
  locations.forEach(loc => {
    const locPath = basePath + path.sep + format(loc, config.variables) + file.name;
    try {
      const stat = fs.statSync(locPath);
      found = true;
      config.icons[sanitizeName(file.name)] = {
        path: loc + path.basename(file.name, path.extname(file.name)),
        rmFill: true,
      };
    } catch (err) {
      // nop
    }
  });

  if (!found) {
    alert(`not found: ${file.name}`);
  }
}

dropzone.addEventListener('drop', (evt) => {
  evt.preventDefault();
  console.log('drop', evt.dataTransfer.files[0]);
  for (let i = 0; i < evt.dataTransfer.files.length; ++i) {
    addFile(evt.dataTransfer.files[i]);
  }
  saveChanges();
}, false);

dropzone.addEventListener('dragenter', (evt) => {
  console.log('drag enter', evt);
}, false);

document.ondragover = document.ondrop = evt => {
  evt.preventDefault();
};

document.querySelector('#generate').addEventListener('click', () => {
  const proc = spawn('node', ['generateicons.js']);
  proc.stdout.on('data', (output) => {
    console.log(output.toString());
  });
  proc.stderr.on('data', (output) => {
    console.error(output.toString());
    alert(output.toString());
  });
});

document.querySelector('#deploy').addEventListener('click', () => {
  console.log('run npm', path.resolve(__dirname, '..', '..'));
  const exe = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  spawn(exe, ['run', '_assets_out'], {
    cwd: path.resolve(__dirname, '..', '..'),
  });
});

fs.watchFile(configPath, () => {
  refreshIcons();
});

refreshIcons();
