import React, { FC, useState } from 'react';
import { DanceArenaSettings, FormationType } from '../types';
import { IconArrowLeft, IconFormationCircle, IconFormationGrid, IconFormationLine, IconFormationV } from '../components/Icons';

const FormationButton: FC<{
  formation: FormationType;
  selected: FormationType;
  onSelect: (f: FormationType) => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}> = ({ formation, selected, onSelect, children, icon }) => (
  <button
    onClick={() => onSelect(formation)}
    className={`p-4 rounded-xl border-2 transition-all duration-200 text-center w-full
      ${selected === formation 
        ? 'bg-lime-400 border-lime-400 text-black' 
        : 'bg-zinc-800 border-zinc-700 text-white hover:border-lime-500'}`}
  >
    <div className="w-12 h-12 mx-auto mb-2">{icon}</div>
    <span className="font-semibold">{children}</span>
  </button>
);

const DanceArenaSetup: FC<{
  onStart: (settings: DanceArenaSettings) => void;
  onGoHome: () => void;
}> = ({ onStart, onGoHome }) => {
  const [dancerCount, setDancerCount] = useState(5);
  const [formation, setFormation] = useState<FormationType>('v-shape');

  const handleSubmit = () => {
    onStart({ dancerCount, formation });
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex flex-col items-center justify-center p-4 animate-page-fade-in">
      <div className="absolute top-4 left-4 z-10">
        <button onClick={onGoHome} className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
          <IconArrowLeft className="w-6 h-6 text-white" />
        </button>
      </div>
      
      <div className="w-full max-w-2xl glassmorphic p-8 rounded-2xl shadow-2xl">
        <h1 className="text-4xl font-bold text-center mb-2">Assemble Your Crew</h1>
        <p className="text-zinc-400 text-center mb-8">Configure your AI dance team before you enter the arena.</p>

        <div className="space-y-8">
          {/* Dancer Count */}
          <div>
            <label htmlFor="dancerCount" className="block text-xl font-semibold mb-3">Number of Dancers</label>
            <div className="flex items-center space-x-4">
              <input
                id="dancerCount"
                type="range"
                min="1"
                max="15"
                value={dancerCount}
                onChange={(e) => setDancerCount(parseInt(e.target.value, 10))}
                className="w-full h-3 bg-zinc-700 rounded-lg appearance-none cursor-pointer range-lg accent-lime-400"
              />
              <span className="text-4xl font-bold w-16 text-center">{dancerCount}</span>
            </div>
          </div>

          {/* Formation */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Formation</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormationButton formation="line" selected={formation} onSelect={setFormation} icon={<IconFormationLine className="w-full h-full" />}>Line</FormationButton>
              <FormationButton formation="v-shape" selected={formation} onSelect={setFormation} icon={<IconFormationV className="w-full h-full" />}>V-Shape</FormationButton>
              <FormationButton formation="circle" selected={formation} onSelect={setFormation} icon={<IconFormationCircle className="w-full h-full" />}>Circle</FormationButton>
              <FormationButton formation="grid" selected={formation} onSelect={setFormation} icon={<IconFormationGrid className="w-full h-full" />}>Grid</FormationButton>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full mt-10 bg-lime-400 text-black font-bold py-4 px-6 rounded-xl text-lg hover:bg-lime-300 transition-all duration-300 transform hover:scale-105"
        >
          Enter Dance Arena
        </button>
      </div>
    </div>
  );
};

export default DanceArenaSetup;
