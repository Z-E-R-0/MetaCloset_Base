import React, { FC } from 'react';
import { Accessory } from '../types';
import { IconX, IconSpinner, IconCheck } from './Icons';

interface AccessorySelectorProps {
  accessories: Accessory[];
  selectedAccessory: Accessory | null;
  onSelect: (accessory: Accessory | null) => void;
  onClose: () => void;
  loadingAccessoryId: string | null;
  loadedAccessoryIds: Set<string>;
}

export const AccessorySelector: FC<AccessorySelectorProps> = ({ accessories, selectedAccessory, onSelect, onClose, loadingAccessoryId, loadedAccessoryIds }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-4 z-40 animate-fade-in-scale">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">Jewelry</h3>
        <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full">
            <IconX className="w-6 h-6" />
        </button>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {/* "None" button */}
        <button
            onClick={() => onSelect(null)}
            className={`relative flex-shrink-0 w-24 h-24 rounded-lg border-2 flex items-center justify-center transition-colors
                ${!selectedAccessory ? 'border-amber-400 bg-white/20' : 'border-transparent bg-white/10 hover:border-zinc-400'}`}
        >
            <div className="w-12 h-12 bg-zinc-500/50 rounded-full flex items-center justify-center">
                 <IconX className="w-8 h-8 text-white/70" />
            </div>
        </button>
        {/* Accessory items */}
        {accessories.map(acc => {
            const isLoading = loadingAccessoryId === acc.id;
            const isLoaded = loadedAccessoryIds.has(acc.id);
            return (
                <button
                    key={acc.id}
                    onClick={() => onSelect(acc)}
                    disabled={isLoading}
                    className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-colors
                        ${selectedAccessory?.id === acc.id ? 'border-amber-400' : 'border-transparent hover:border-zinc-400'}`}
                >
                    {acc.previewImageUrl ? (
                        <img src={acc.previewImageUrl} alt={acc.name} className={`w-full h-full object-cover transition-opacity ${isLoading ? 'opacity-30' : ''}`} />
                    ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center p-2 font-semibold">
                            {acc.name}
                        </div>
                    )}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <IconSpinner className="w-8 h-8 animate-spin text-white" />
                        </div>
                    )}
                    {isLoaded && !isLoading && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white shadow-md">
                        <IconCheck className="w-3 h-3" />
                        </div>
                    )}
                </button>
            );
        })}
      </div>
    </div>
  );
};