import React, { FC } from 'react';
import { IconRotate360 } from './Icons';

interface RotationControlProps {
  isAutoRotating: boolean;
  onToggle: () => void;
}

export const RotationControl: FC<RotationControlProps> = ({ isAutoRotating, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center space-x-2 px-3 py-2 text-sm font-semibold rounded-lg shadow-lg transition-colors duration-200
          ${isAutoRotating ? 'bg-amber-400 text-black' : 'bg-black/50 backdrop-blur-md text-white'}`}
      aria-pressed={isAutoRotating}
      aria-label="Toggle 360 degree rotation"
    >
      <IconRotate360 className="w-5 h-5" />
      <span>360° View</span>
    </button>
  );
};
