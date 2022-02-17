import React from 'react';

export function Overlay(props: {url: string}) {
  return (
    <div className="onboarding-overlay-content">
      <iframe 
        width="100%" 
        height="280" 
        src={props.url}
        title="YouTube video player" 
        frameBorder={0}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
        <div>
          <button>Mark as complete</button>
        </div>
    </div>
  )
}