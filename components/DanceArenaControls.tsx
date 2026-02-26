import React, { FC, useState } from 'react';
import { IconChevronDown, IconUsers } from './Icons';

export type FormationType = 'line' | 'v-shape' | 'circle' | 'grid';

interface DanceArenaControlsProps {
    numAvatars: number;
    setNumAvatars: (num: number) => void;
    formation: FormationType;
    setFormation: (formation: FormationType) => void;
    spacing: number;
    setSpacing: (spacing: number) => void;
}

const FormationButton: FC<{ label: string; type: FormationType; current: FormationType; onClick: (type: FormationType) => void }> = ({ label, type, current, onClick }) => (
    <button
        onClick={() => onClick(type)}
        className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all duration-200 border-2 ${
            current === type ? 'bg-lime-400 text-black border-lime-400' : 'bg-transparent text-white border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
        }`}
    >
        {label}
    </button>
);


export const DanceArenaControls: FC<DanceArenaControlsProps> = ({ numAvatars, setNumAvatars, formation, setFormation, spacing, setSpacing }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="glassmorphic p-4 rounded-2xl shadow-lg text-white w-80">
      <button 
        className="w-full flex justify-between items-center text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
            <IconUsers className="w-5 h-5"/>
            <h3 className="text-sm font-bold">Dance Arena Controls</h3>
        </div>
        <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-4 space-y-4">
            <div>
                <label className="block text-sm font-medium text-zinc-300">Formation</label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                    <FormationButton label="Line" type="line" current={formation} onClick={setFormation} />
                    <FormationButton label="V" type="v-shape" current={formation} onClick={setFormation} />
                    <FormationButton label="Circle" type="circle" current={formation} onClick={setFormation} />
                    <FormationButton label="Grid" type="grid" current={formation} onClick={setFormation} />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-zinc-300">Number of Dancers</label>
                 <div className="flex items-center space-x-3 mt-1">
                    <input
                        type="range"
                        min="1"
                        max="25"
                        step="1"
                        value={numAvatars}
                        onChange={(e) => setNumAvatars(parseInt(e.target.value, 10))}
                        aria-label="Number of dancers slider"
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-lime-400"
                    />
                    <span className="text-sm font-mono w-8 text-right">{numAvatars}</span>
                </div>
            </div>
            
             <div>
                <label className="block text-sm font-medium text-zinc-300">Spacing</label>
                 <div className="flex items-center space-x-3 mt-1">
                    <input
                        type="range"
                        min="0.5"
                        max="5"
                        step="0.1"
                        value={spacing}
                        onChange={(e) => setSpacing(parseFloat(e.target.value))}
                        aria-label="Spacing slider"
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-lime-400"
                    />
                    <span className="text-sm font-mono w-8 text-right">{spacing.toFixed(1)}</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};