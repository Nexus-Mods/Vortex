import * as React from 'react';
import { semanticColorTokens } from '../tokens/semanticColors';

// Demo component to showcase the new semantic color system
export const SemanticColorDemo: React.FC = () => {
  return (
    <div className="tw:p-6 tw:space-y-6">
      {/* Surface examples */}
      <div>
        <h3 className={semanticColorTokens.textStrong + ' tw:text-lg tw:font-bold tw:mb-3'}>
          Surface Colors
        </h3>
        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div className={semanticColorTokens.surfaceBase + ' tw:p-4 tw:rounded-lg'}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Surface Base</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Main background color</div>
          </div>
          <div className={semanticColorTokens.surfaceLow + ' tw:p-4 tw:rounded-lg'}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Surface Low</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Subtle backgrounds</div>
          </div>
          <div className={semanticColorTokens.surfaceMid + ' tw:p-4 tw:rounded-lg'}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Surface Mid</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Card backgrounds</div>
          </div>
          <div className={semanticColorTokens.surfaceHigh + ' tw:p-4 tw:rounded-lg'}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Surface High</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Elevated surfaces</div>
          </div>
        </div>
      </div>

      {/* Text examples */}
      <div>
        <h3 className={semanticColorTokens.textStrong + ' tw:text-lg tw:font-bold tw:mb-3'}>
          Text Colors
        </h3>
        <div className="tw:space-y-2">
          <div className={semanticColorTokens.textStrong + ' tw:text-lg'}>
            Strong text - primary content
          </div>
          <div className={semanticColorTokens.textModerate + ' tw:text-base'}>
            Moderate text - secondary content
          </div>
          <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>
            Weak text - tertiary content
          </div>
          <div className={semanticColorTokens.textSubdued + ' tw:text-xs'}>
            Subdued text - captions and labels
          </div>
        </div>
      </div>

      {/* Status colors */}
      <div>
        <h3 className={semanticColorTokens.textStrong + ' tw:text-lg tw:font-bold tw:mb-3'}>
          Status Colors
        </h3>
        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div className={semanticColorTokens.successBg + ' tw:p-3 tw:rounded-lg tw:text-white'}>
            <div className="tw:font-medium">Success</div>
            <div className="tw:text-sm tw:opacity-90">Operation completed</div>
          </div>
          <div className={semanticColorTokens.infoBg + ' tw:p-3 tw:rounded-lg tw:text-white'}>
            <div className="tw:font-medium">Info</div>
            <div className="tw:text-sm tw:opacity-90">Additional information</div>
          </div>
          <div className={semanticColorTokens.warningBg + ' tw:p-3 tw:rounded-lg tw:text-white'}>
            <div className="tw:font-medium">Warning</div>
            <div className="tw:text-sm tw:opacity-90">Proceed with caution</div>
          </div>
          <div className={semanticColorTokens.dangerBg + ' tw:p-3 tw:rounded-lg tw:text-white'}>
            <div className="tw:font-medium">Danger</div>
            <div className="tw:text-sm tw:opacity-90">Destructive action</div>
          </div>
        </div>
      </div>

      {/* Primary brand */}
      <div>
        <h3 className={semanticColorTokens.textStrong + ' tw:text-lg tw:font-bold tw:mb-3'}>
          Primary Brand
        </h3>
        <div className={semanticColorTokens.primaryBg + ' tw:p-4 tw:rounded-lg tw:text-white'}>
          <div className="tw:font-medium">Primary Action</div>
          <div className="tw:text-sm tw:opacity-90">Main brand color for CTAs</div>
        </div>
      </div>

      {/* Border examples */}
      <div>
        <h3 className={semanticColorTokens.textStrong + ' tw:text-lg tw:font-bold tw:mb-3'}>
          Border Colors
        </h3>
        <div className="tw:grid tw:grid-cols-3 tw:gap-4">
          <div className={`${semanticColorTokens.surfaceMid} ${semanticColorTokens.borderWeak} tw:p-3 tw:rounded-lg tw:border`}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Weak</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Subtle borders</div>
          </div>
          <div className={`${semanticColorTokens.surfaceMid} ${semanticColorTokens.borderModerate} tw:p-3 tw:rounded-lg tw:border`}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Moderate</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Standard borders</div>
          </div>
          <div className={`${semanticColorTokens.surfaceMid} ${semanticColorTokens.borderStrong} tw:p-3 tw:rounded-lg tw:border`}>
            <div className={semanticColorTokens.textStrong + ' tw:font-medium'}>Strong</div>
            <div className={semanticColorTokens.textWeak + ' tw:text-sm'}>Prominent borders</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemanticColorDemo;