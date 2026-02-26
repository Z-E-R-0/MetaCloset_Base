import React, { FC } from 'react';
import { IconDownload } from '../components/Icons';

interface DownloadPageProps {
  imageUrl: string;
  onGoHome: () => void;
}

const DownloadPage: FC<DownloadPageProps> = ({ imageUrl, onGoHome }) => {

    return (
        <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-4 animate-page-fade-in">
            <div className="w-full max-w-md mx-auto text-center">
                <h1 className="text-3xl font-bold text-white">Your MetaCloset Moment</h1>
                <p className="text-zinc-400 mt-2 mb-6">Here is your personalized image. Tap to download and share it!</p>
            </div>

            <div className="relative w-full max-w-md aspect-[9/16] shadow-2xl rounded-lg overflow-hidden bg-zinc-800 mb-6">
                <img src={imageUrl} alt="Your personalized MetaCloset image" className="w-full h-full object-contain" />
            </div>

            <div className="w-full max-w-md mx-auto grid grid-cols-1 gap-4">
                <a
                    href={imageUrl}
                    download="metacloset-moment.jpg"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center space-x-3 bg-lime-400 text-black font-bold py-4 px-6 rounded-xl text-lg hover:bg-lime-300 transition-all duration-300 transform hover:scale-105"
                >
                    <IconDownload className="w-6 h-6"/>
                    <span>Download Image</span>
                </a>
                <button
                    onClick={onGoHome}
                    className="w-full flex items-center justify-center space-x-3 bg-zinc-800 text-white font-bold py-4 px-6 rounded-xl text-lg hover:bg-zinc-700 transition-all"
                >
                    <span>Create Another</span>
                </button>
            </div>
        </div>
    );
};

export default DownloadPage;