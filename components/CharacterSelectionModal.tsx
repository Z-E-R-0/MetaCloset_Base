import React, { FC, useState } from 'react';
import { CharacterSelection } from '../types';

interface CharacterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: CharacterSelection) => void;
}

export const CharacterSelectionModal: FC<CharacterSelectionModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [age] = useState<'adult'>('adult'); // Only one option for now

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({ gender, age });
  };
  
  const GenderButton: FC<{ value: 'male' | 'female', children: React.ReactNode }> = ({ value, children }) => (
    <button
        onClick={() => setGender(value)}
        className={`w-full text-center py-3 px-6 rounded-lg border-2 transition-all duration-200 font-semibold
            ${gender === value 
                ? 'bg-[#D4AF37] text-black border-[#D4AF37]' 
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:border-zinc-400'
            }`}
    >
        {children}
    </button>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-modal-title"
    >
      <div 
        className="bg-[#FDFBF6] border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="character-modal-title" className="text-2xl font-bold text-zinc-800 mb-2">Personalize Your Model</h2>
        <p className="text-zinc-500 mb-8">This helps us fit the virtual clothing correctly.</p>
        
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-zinc-700 mb-3 text-left">Gender</h3>
                <div className="grid grid-cols-2 gap-4">
                    <GenderButton value="female">Female</GenderButton>
                    <GenderButton value="male">Male</GenderButton>
                </div>
            </div>
            
            <div>
                <h3 className="text-lg font-semibold text-zinc-700 mb-3 text-left">Age Group</h3>
                <div className="text-zinc-600 bg-zinc-100 text-left p-3 rounded-lg border border-zinc-200">
                    Adult (18+)
                </div>
            </div>
        </div>

        <button
            onClick={handleConfirm}
            className="w-full mt-10 bg-[#D4AF37] text-black font-bold py-3 px-6 rounded-xl text-lg hover:bg-[#c8a432] transition-all duration-300 transform hover:scale-105"
        >
          Continue
        </button>
      </div>
    </div>
  );
};