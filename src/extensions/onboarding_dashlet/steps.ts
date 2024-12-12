export const STEPS: IStep[] = [
  {
    title: 'Manage your game',
    desc: 'Learn how to add games for Vortex to manage.',
    length: '2:25',
    img: 'assets/images/dashlets/add-game.png',
    video: 'https://www.youtube.com/embed/_9ZT49X9fvQ',
    id: 'add-game',
  },
  {
    title: 'Download mods',
    desc: 'Learn how to download mods to your games.',
    length: '3:24',
    img: 'assets/images/dashlets/add-mods.png',
    video: 'https://www.youtube.com/embed/noVpQl3mkfE',
    id: 'add-mods',
  }
];

export interface IStep {
  title: string;
  desc: string;
  length: string;
  img: string;
  video: string;
  id: string;
}
