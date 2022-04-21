export const STEPS: IStep[] = [
  {
    title: 'Manage your game',
    desc: 'Learn how to add games for Vortex to manage.',
    lenght: '2:30',
    img: 'assets/images/dashlets/add-game.png',
    video: 'https://www.youtube.com/embed/qdn4yguKHaY',
    id: 'add-game',
  },
  {
    title: 'Log in',
    desc: 'Link your Nexus Mods account to Vortex.',
    lenght: '2:32',
    img: 'assets/images/dashlets/login-link.png',
    video: 'https://www.youtube.com/embed/Coui1FvFK70',
    id: 'login-and-link',
  },
  {
    title: 'Install Tools',
    desc: 'Install any required tools that will allow you to mod your game. ',
    lenght: '3:57',
    img: 'assets/images/dashlets/install-tools.png',
    video: 'https://www.youtube.com/embed/gz99xZGA0LA',
    id: 'install-tools',
  },
  {
    title: 'Download Mods',
    desc: 'Download and install the first of many mods for your game. ',
    lenght: '2:58',
    img: 'assets/images/dashlets/add-mods.png',
    video: 'https://www.youtube.com/embed/UvYiO3__U5Y',
    id: 'download-mods',
  },
];

export interface IStep {
  title: string;
  desc: string;
  lenght: string;
  img: string;
  video: string;
  id: string;
}
