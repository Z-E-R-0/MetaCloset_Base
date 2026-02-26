import React, { FC } from 'react';
import { Garment } from '../types';
import { IconX, IconSpinner, IconCheck } from './Icons';

interface GarmentSelectorProps {
  garments: Garment[];
  selectedGarment: Garment;
  onSelect: (garment: Garment) => void;
  onClose: () => void;
  loadingGarmentId: string | null;
  loadedGarmentIds: Set<string>;
}

export const GarmentSelector: FC<GarmentSelectorProps> = ({ garments, selectedGarment, onSelect, onClose, loadingGarmentId, loadedGarmentIds }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md p-4 z-40 animate-fade-in-scale">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold text-lg">Garments</h3>
        <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full">
            <IconX className="w-6 h-6" />
        </button>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {garments.map(garment => {
          const isLoading = loadingGarmentId === garment.id;
          const isLoaded = loadedGarmentIds.has(garment.id);

          return (
            <button
              key={garment.id}
              onClick={() => onSelect(garment)}
              disabled={isLoading}
              className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-colors
                  ${selectedGarment?.id === garment.id ? 'border-amber-400' : 'border-transparent hover:border-zinc-400'}`}
            >
              {garment.previewImageUrl ? (
                <img src={garment.previewImageUrl} alt={garment.name} className={`w-full h-full object-cover transition-opacity ${isLoading ? 'opacity-30' : ''}`} />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs text-center p-2 font-semibold">
                    {garment.name}
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