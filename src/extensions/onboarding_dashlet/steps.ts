export const STEPS: IStep[] = [
  {
    title: 'Manage your game',
    desc: 'Learn how to add games for Vortex to manage.',
    length: '2:25',
    img: 'https://img.youtube.com/vi/_9ZT49X9fvQ/hqdefault.jpg',
    video: 'https://www.youtube.com/embed/_9ZT49X9fvQ',
    id: 'add-game',
  },
  {
    title: 'Download mods',
    desc: 'Learn how to download mods to your games.',
    length: '3:24',
    img: 'https://img.youtube.com/vi/noVpQl3mkfE/hqdefault.jpg',
    video: 'https://www.youtube.com/embed/noVpQl3mkfE',
    id: 'add-mods',
  },
  {
    title: 'Use Profiles',
    desc: 'Learn how to use Vortex profiles.',
    length: '1:49',
    img: 'https://img.youtube.com/vi/63oESK4MwH8/hqdefault.jpg',
    video: 'https://www.youtube.com/embed/63oESK4MwH8',
    id: 'use-profiles',
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
