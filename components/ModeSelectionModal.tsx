import React, { FC, useRef } from 'react';
import { Garment } from '../types';
import { IconCamera, IconPhoto } from './Icons';

interface ModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  garment: Garment;
  onStartLive: () => void;
  onImageSelected: (imageUrl: string) => void;
}

export const ModeSelectionModal: FC<ModeSelectionModalProps> = ({ isOpen, onClose, garment, onStartLive, onImageSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const imageUrl = URL.createObjectURL(file);
      onImageSelected(imageUrl);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-page-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="glassmorphic rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="modal-title" className="text-2xl font-bold text-white mb-2">Engage: {garment.name}</h2>
        <p className="text-zinc-400 mb-8">Choose your interaction method.</p>
        
        <div className="space-y-4">
          <button
            onClick={onStartLive}
            className="w-full flex items-center justify-center space-x-3 bg-lime-400 text-black font-bold py-4 px-6 rounded-xl text-lg hover:bg-lime-300 transition-all duration-300 transform hover:scale-105"
          >
            <IconCamera className="w-6 h-6" />
            <span>Enter Live Studio</span>
          </button>
          
          <button
            onClick={handleUploadClick}
            className="w-full flex items-center justify-center space-x-3 bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold py-4 px-6 rounded-xl text-lg hover:bg-zinc-700 transition-all duration-300 transform hover:scale-105"
          >
            <IconPhoto className="w-6 h-6" />
            <span>Upload Holo-Image</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>

        <button
          onClick={onClose}
          className="mt-8 text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};