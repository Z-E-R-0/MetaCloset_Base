import React, { FC } from 'react';
import { IconBug } from './Icons';

interface DebugPaneProps {
  onDebugRotate: () => void;
}

export const DebugPane: FC<DebugPaneProps> = ({ onDebugRotate }) => {
  return (
    <div className="bg-lime-500/80 backdrop-blur-sm p-2 rounded-xl shadow-lg text-black">
      <button
        onClick={onDebugRotate}
        className="flex items-center space-x-2 px-3 py-1"
        title="Rotate Left Shoulder 90°"
      >
        <IconBug className="w-5 h-5" />
        <span className="text-sm font-bold">Debug Rotate</span>
      </button>
    </div>
  );
};