export const STEPS: IStep[] = [
  {
    title: 'Manage your game',
    desc: 'Learn how to add games for Vortex to manage.',
    length: '2:28',
    img: 'assets/images/dashlets/add-game.png',
    video: 'https://www.youtube.com/embed/vmJFBHD6gvg',
    id: 'add-game',
  },
  {
    title: 'Log in',
    desc: 'Link your Nexus Mods account to Vortex.',
    length: '2:25',
    img: 'assets/images/dashlets/login-link.png',
    video: 'https://www.youtube.com/embed/IMySUQ1flkQ',
    id: 'login-and-link',
  },
  {
    title: 'Install Tools',
    desc: 'Install any required tools that will allow you to mod your game. ',
    length: '4:13',
    img: 'assets/images/dashlets/install-tools.png',
    video: 'https://www.youtube.com/embed/boaEMPpmGDc',
    id: 'install-tools',
  },
  {
    title: 'Download Mods',
    desc: 'Download and install the first of many mods for your game. ',
    length: '3:00',
    img: 'assets/images/dashlets/add-mods.png',
    video: 'https://www.youtube.com/embed/Kt_6lwGd2Ns',
    id: 'download-mods',
  },
];

export interface IStep {
  title: string;
  desc: string;
  length: string;
  img: string;
  video: string;
  id: string;
}
