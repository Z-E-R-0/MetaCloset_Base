import React, { FC } from 'react';
import { IconTarget } from './Icons';

interface TrackingIndicatorProps {
  isVisible: boolean;
  garmentName: string;
}

export const TrackingIndicator: FC<TrackingIndicatorProps> = ({ isVisible, garmentName }) => {
  return (
    <div 
      className={`
        absolute bottom-32 left-1/2 -translate-x-1/2 z-30
        flex items-center justify-center
        glassmorphic text-white
        py-2 px-5 rounded-full shadow-lg
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      aria-live="polite"
      aria-atomic="true"
    >
      <IconTarget className="w-5 h-5 mr-2 text-lime-400" />
      <span className="font-semibold text-sm">{garmentName} Tracked</span>
    </div>
  );
};