export const STEPS: IStep[] = [
  {
    title: "Manage your game",
    desc: "Link your account and add games.",
    length: "1:34",
    img: "https://img.youtube.com/vi/Nn4fLIbe7mU/hqdefault.jpg",
    video: "https://www.youtube-nocookie.com/embed/Nn4fLIbe7mU",
    id: "add-game",
  },
  {
    title: "Browse & install mods",
    desc: "Install mods through Vortex.",
    length: "2:29",
    img: "https://img.youtube.com/vi/MxmZNONcSVU/hqdefault.jpg",
    video: "https://www.youtube-nocookie.com/embed/MxmZNONcSVU",
    id: "add-mods",
  },
  {
    title: "Using Profiles in Vortex",
    desc: "Learn how to use Vortex profiles.",
    length: "1:23",
    img: "https://img.youtube.com/vi/tNfA0iZ7kgw/hqdefault.jpg",
    video: "https://www.youtube-nocookie.com/embed/tNfA0iZ7kgw",
    id: "use-profiles",
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
