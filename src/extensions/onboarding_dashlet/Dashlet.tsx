import Dashlet from '../../controls/Dashlet';
import React from 'react';

function OnBoardingCard(props: {
  title: string,
  lenght: string,
  video: string,
  desc: string,
  img: string,
  count: number
}) {
  return (
    <div className='onboarding-card'>
      <img className='onboarding-card-image' src={props.img} alt="" />
      <div className='onboarding-card-body'>
        <div className='onboarding-card-title-wrapper'>
          <span className='onboarding-card-counter'>{props.count}</span>
          <div className='onboarding-card-title-container'>
            <span className='onboarding-card-title'>{props.title}</span>
            <span className='onboarding-card-lenght'>{props.lenght}</span>
          </div>
        </div>
        <span className='onboarding-card-desc'>
          {props.desc}
        </span>
      </div>
    </div>
  )
}

function OnBoardingDashlet() {
  return (
    <Dashlet title='Get Started' className='dashlet-onboarding'>
      <p className='onboarding-subtitle'> Watch these 5 videos to guide you on how to start modding you favourite games. </p>
      <div className='onboarding-card-list'>
        <OnBoardingCard
          title='add your game'
          desc='Learn how to add games for Vortex to manage.'
          lenght='1:10'
          img="assets/images/dashlets/add-game.png"
          video='nil'
          count={1} />
        <OnBoardingCard
          title='Install Tools'
          desc='Install any required tools that will allow you to mod your game. '
          lenght='1:20'
          img="assets/images/dashlets/add-mods.png"
          video='nil'
          count={2} />
        <OnBoardingCard
          title='Download Mods'
          desc='Install any required tools that will allow you to mod your game. '
          lenght='2:20'
          img="assets/images/dashlets/install-tools.png"
          video='nil'
          count={3} />
        <OnBoardingCard
          title='Deploy Mods'
          desc='Search, download and install mods. '
          lenght='3:20'
          img="assets/images/dashlets/login-link.png"
          video='nil'
          count={4} />
      </div>
    </Dashlet>
  );
}

export default OnBoardingDashlet