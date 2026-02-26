import React, { FC, useEffect, useRef, useState } from 'react';
import { IconArrowLeft, IconDownload, IconSpinner } from '../components/Icons';
import { AppConfig } from '../types';


interface SharePageProps {
  capturedImage: string;
  onGoHome: () => void;
  config: AppConfig;
  configName: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        if (!src || src.trim() === '' || src.toLowerCase() === 'data:,') {
            return reject(new Error(`Invalid image source provided: "${src}"`));
        }
        const img = new Image();
        // Only set crossOrigin for remote images, not for data URLs, to avoid tainting the canvas.
        if (!src.startsWith('data:')) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image from src: ${src}`));
        img.src = src;
    });
};

const SharePage: FC<SharePageProps> = ({ capturedImage, onGoHome, config, configName }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [finalImage, setFinalImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(true);
    const [publicImageUrl, setPublicImageUrl] = useState<string | null>(null);
    const [processingError, setProcessingError] = useState<string | null>(null);

    const { shareOverlayUrl } = config.brandAssets;

    useEffect(() => {
        const generateImage = async () => {
            setIsGenerating(true);
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            
            if (!shareOverlayUrl) {
                setProcessingError("Share page overlay image is not configured in Brand Assets.");
                setIsGenerating(false);
                return;
            }

            try {
                const [userImg, overlayImg] = await Promise.all([
                    loadImage(capturedImage),
                    loadImage(shareOverlayUrl)
                ]);
                
                // Set canvas to the desired output resolution
                canvas.width = 1080;
                canvas.height = 1920;
                
                // Implement 'object-cover' logic to draw the user image without distortion.
                const canvasRatio = canvas.width / canvas.height; // 9 / 16
                const imgRatio = userImg.width / userImg.height;
                let sx, sy, sWidth, sHeight;

                if (imgRatio > canvasRatio) {
                    // Image is wider than canvas, so crop sides of image
                    sHeight = userImg.height;
                    sWidth = sHeight * canvasRatio;
                    sx = (userImg.width - sWidth) / 2;
                    sy = 0;
                } else {
                    // Image is taller than canvas, so crop top/bottom of image
                    sWidth = userImg.width;
                    sHeight = sWidth / canvasRatio;
                    sx = 0;
                    sy = (userImg.height - sHeight) / 2;
                }
                ctx.drawImage(userImg, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

                // Draw the branding overlay on top. It's expected to be a 1080x1920 transparent PNG.
                ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);

                setFinalImage(canvas.toDataURL('image/jpeg', 0.9));
            } catch (error) {
                console.error("Failed to generate final image:", error);
                setProcessingError("Failed to create final image. Check if the overlay image is valid.");
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [capturedImage, shareOverlayUrl]);
    
    useEffect(() => {
        if (!finalImage) return;
        setPublicImageUrl(null); // No cloud upload; share via download only
    }, [finalImage]);

    const handleDownload = () => {
        if (!finalImage) return;
        const link = document.createElement('a');
        link.href = finalImage;
        link.download = 'metacloset-moment.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const downloadPageUrl = publicImageUrl 
        ? `${window.location.origin}${window.location.pathname}#/download?url=${encodeURIComponent(publicImageUrl)}`
        : null;

    const qrCodeUrl = downloadPageUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(downloadPageUrl)}&bgcolor=010101&color=A3E635&qzone=1`
        : null;


    return (
        <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-4 animate-page-fade-in lg:flex-row lg:gap-8">
             <div className="absolute top-4 left-4 z-50">
                <button onClick={onGoHome} className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
                    <IconArrowLeft className="w-6 h-6 text-white" />
                </button>
            </div>
            
            <div className="w-full max-w-md">
                <div className="relative aspect-[9/16] shadow-2xl rounded-lg overflow-hidden bg-zinc-800">
                    {(isGenerating || !finalImage) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                            <IconSpinner className="w-16 h-16 animate-spin text-lime-400" />
                            <p className="mt-4 text-zinc-300 font-semibold">Generating your moment...</p>
                        </div>
                    )}
                    <canvas ref={canvasRef} width="1080" height="1920" className="hidden"></canvas>
                    {finalImage && <img src={finalImage} alt="Final sharable image" className="w-full h-full object-contain" />}
                </div>
            </div>

            <div className="w-full max-w-md mt-6 lg:mt-0 text-center lg:text-left">
                <h1 className="text-3xl font-bold text-white">Your Digital Self, Realized.</h1>
                <p className="text-zinc-400 mt-2 mb-6">Your image is ready. Download it directly, or scan the QR code to open it on your phone.</p>
                
                <div className="w-full p-6 glassmorphic rounded-2xl shadow-lg">
                    <h2 className="font-bold text-lg text-white mb-4">Scan to get on your phone</h2>
                    <div className="w-full aspect-square bg-zinc-900/50 rounded-lg flex items-center justify-center">
                        {processingError && <p className="text-red-500 text-sm p-4 text-center">{processingError}</p>}
                        {qrCodeUrl && <img src={qrCodeUrl} alt="QR code to download image" className="w-full h-full object-contain rounded-lg p-2"/>}
                        {!qrCodeUrl && !processingError && finalImage && <p className="text-zinc-500 text-sm p-4 text-center">Download the image to this device using the button below.</p>}
                    </div>
                </div>

                 <div className="w-full mt-6 grid grid-cols-1 gap-4">
                    <button
                        onClick={handleDownload}
                        disabled={!finalImage}
                        className="w-full flex items-center justify-center space-x-3 bg-lime-400 text-black font-bold py-4 px-6 rounded-xl text-lg hover:bg-lime-300 transition-all duration-300 transform hover:scale-105 disabled:bg-zinc-600 disabled:text-zinc-400 disabled:cursor-not-allowed"
                    >
                        <IconDownload className="w-6 h-6"/>
                        <span>Download to this device</span>
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default SharePage;