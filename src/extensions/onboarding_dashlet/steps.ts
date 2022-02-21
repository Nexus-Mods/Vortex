export const STEPS: IStep[] = [
  {
    title: 'add your game',
    desc: 'Learn how to add games for Vortex to manage.',
    lenght: '1:10',
    img: "assets/images/dashlets/add-game.png",
    video: "https://www.youtube-nocookie.com/embed/qdn4yguKHaY",
    id: 'add-game',
  },
  {
    title: 'Install Tools',
    desc: 'Install any required tools that will allow you to mod your game. ',
    lenght: '1:20',
    img: "assets/images/dashlets/add-mods.png",
    video: "https://www.youtube-nocookie.com/embed/gz99xZGA0LA",
    id: 'install-tools',
  },
  {
    title: 'Download Mods',
    desc: 'Install any required tools that will allow you to mod your game. ',
    lenght: '2:20',
    img: "assets/images/dashlets/install-tools.png",
    video: "https://www.youtube-nocookie.com/embed/UvYiO3__U5Y",
    id: 'download-mods',
  },
  {
    title: 'Logging in and linking your Account in Vortex',
    desc: 'Search, download and install mods. ',
    lenght: '3:20',
    img: "assets/images/dashlets/login-link.png",
    video: "https://www.youtube-nocookie.com/embed/Coui1FvFK70",
    id: 'login-and-link',
  }
]

export interface IStep {
  title: string
  desc: string
  lenght: string
  img: string
  video: string
  id: string
}