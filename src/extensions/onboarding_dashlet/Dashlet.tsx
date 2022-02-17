import Dashlet from '../../controls/Dashlet';
import React from 'react';

export type onCardClick = (payload: onCardClickPayload) => void

export type onCardClickPayload = {
  title: string,
  video: string,
  count: number,
  desc: string,
  pos: { x: number, y: number }
}

function OnBoardingCard(props: {
  title: string,
  lenght: string,
  video: string,
  desc: string,
  img: string,
  count: number,
  onClick: onCardClick
}) {
  const { count, desc, img, lenght, onClick, title, video } = props

  return (
    <div className='onboarding-card' onClick={() => onClick({
      count,
      title,
      video,
      desc,
      pos: { x: window.innerWidth - 16, y: window.innerHeight }
    })}>
      <img className='onboarding-card-image' src={img} alt="" />
      <div className='onboarding-card-body'>
        <div className='onboarding-card-title-wrapper'>
          <span className='onboarding-card-counter'>{count}</span>
          <div className='onboarding-card-title-container'>
            <span className='onboarding-card-title'>{title}</span>
            <span className='onboarding-card-lenght'>{lenght}</span>
          </div>
        </div>
        <span className='onboarding-card-desc'>
          {desc}
        </span>
      </div>
    </div>
  )
}

function OnBoardingDashlet(props: {
  onCardClick: onCardClick
}) {
  const { onCardClick } = props;

  return (
    <Dashlet title='Get Started' className='dashlet-onboarding'>
      <p className='onboarding-subtitle'> Watch these 5 videos to guide you on how to start modding you favourite games. </p>
      <div className='onboarding-card-list'>
        <OnBoardingCard
          title='add your game'
          desc='Learn how to add games for Vortex to manage.'
          lenght='1:10'
          img="assets/images/dashlets/add-game.png"
          video="https://www.youtube-nocookie.com/embed/qdn4yguKHaY"
          count={1}
          onClick={onCardClick} />
        <OnBoardingCard
          title='Install Tools'
          desc='Install any required tools that will allow you to mod your game. '
          lenght='1:20'
          img="assets/images/dashlets/add-mods.png"
          video="https://www.youtube-nocookie.com/embed/gz99xZGA0LA"
          count={2}
          onClick={onCardClick} />
        <OnBoardingCard
          title='Download Mods'
          desc='Install any required tools that will allow you to mod your game. '
          lenght='2:20'
          img="assets/images/dashlets/install-tools.png"
          video="https://www.youtube-nocookie.com/embed/UvYiO3__U5Y"
          count={3}
          onClick={onCardClick} />
        <OnBoardingCard
          title='Logging in and linking your Account in Vortex'
          desc='Search, download and install mods. '
          lenght='3:20'
          img="assets/images/dashlets/login-link.png"
          video="https://www.youtube-nocookie.com/embed/Coui1FvFK70"
          count={4}
          onClick={onCardClick} />
      </div>
    </Dashlet>
  );
}

export default OnBoardingDashlet