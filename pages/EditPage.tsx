import React, { FC, useEffect, useRef, useState, useCallback } from 'react';
import { EditPageData, AppConfig, BackgroundImage, Garment } from '../types';
import { IconArrowLeft, IconSpinner, IconCheck, IconPhoto, IconSparkles } from '../components/Icons';
import { GoogleGenAI, Modality } from "@google/genai";

interface EditPageProps {
  data: EditPageData;
  onComplete: (finalImageData: string) => void;
  onGoHome: () => void;
  config: AppConfig;
}

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        if (!src || src.trim() === '' || src.toLowerCase() === 'data:,') {
            return reject(new Error(`Invalid image source provided: "${src}"`));
        }
        const img = new Image();
        if (!src.startsWith('data:')) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image from src: ${src}`));
        img.src = src;
    });
};

const BackgroundThumbnail: FC<{ bg: BackgroundImage; isSelected: boolean; onClick: () => void; }> = ({ bg, isSelected, onClick }) => (
    <div className="aspect-w-9 aspect-h-16">
        <button
            onClick={onClick}
            className={`w-full h-full rounded-lg overflow-hidden border-4 transition-all duration-300 relative group focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-black focus:ring-lime-400/80
                ${isSelected ? 'border-lime-400 shadow-lg' : 'border-transparent hover:border-zinc-600'}`}
        >
            {bg.id === 'original' ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center bg-zinc-800 text-zinc-400">
                    <IconPhoto className="w-10 h-10 mb-2"/>
                    <span className="font-semibold text-sm">Original</span>
                </div>
            ) : (
                <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
            )}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 ${bg.id !== 'original' ? 'opacity-0 group-hover:opacity-100' : ''} transition-opacity`}>
                <span className="text-white text-xs font-bold text-center w-full truncate">{bg.name}</span>
            </div>
             {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-lime-400 rounded-full flex items-center justify-center text-black shadow-md">
                    <IconCheck className="w-4 h-4"/>
                </div>
             )}
        </button>
    </div>
);


const EditPage: FC<EditPageProps> = ({ data, onComplete, onGoHome, config }) => {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isCompositing, setIsCompositing] = useState(true);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [selectedBg, setSelectedBg] = useState(config.backgroundImages[0].id);
    const [loadingMessage, setLoadingMessage] = useState('Preparing your photo...');
    const [enhancedImageAvailable, setEnhancedImageAvailable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const drawFinalImageOnCanvas = useCallback(async (imageUrl: string) => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
            const img = await loadImage(imageUrl);
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        } catch (e) {
            console.error("Failed to draw enhanced image on canvas", e);
            setError("Could not display the final AI-generated image.");
        }
    }, []);

    const drawCompositeImage = useCallback(async () => {
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
    
        setIsCompositing(true);
        setLoadingMessage('Updating preview...');
        setError(null);

        try {
            const { videoFrame, garmentOverlay, personMask } = data;
            const bgChoice = config.backgroundImages.find(bg => bg.id === selectedBg);

            const [userImg, garmentImg] = await Promise.all([
                loadImage(videoFrame),
                loadImage(garmentOverlay)
            ]);
            
            canvas.width = userImg.width;
            canvas.height = userImg.height;

            if (bgChoice && bgChoice.id !== 'original') {
                const bgImg = await loadImage(bgChoice.url);
                const destRatio = canvas.width / canvas.height;
                const bgRatio = bgImg.width / bgImg.height;
                let sx = 0, sy = 0, sWidth = bgImg.width, sHeight = bgImg.height;
                if (bgRatio > destRatio) {
                    sWidth = sHeight * destRatio;
                    sx = (bgImg.width - sWidth) / 2;
                } else {
                    sHeight = sWidth / destRatio;
                    sy = (bgImg.height - sHeight) / 2;
                }
                ctx.drawImage(bgImg, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

                const cutoutCanvas = document.createElement('canvas');
                cutoutCanvas.width = userImg.width;
                cutoutCanvas.height = userImg.height;
                const cutoutCtx = cutoutCanvas.getContext('2d');
                if (!cutoutCtx) throw new Error("Could not create cutout context");

                cutoutCtx.drawImage(userImg, 0, 0);

                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = personMask.width;
                maskCanvas.height = personMask.height;
                const maskCtx = maskCanvas.getContext('2d');
                if (!maskCtx) throw new Error("Could not create mask context");

                const maskImageData = maskCtx.createImageData(personMask.width, personMask.height);
                for (let i = 0; i < personMask.buffer.length; i++) {
                    maskImageData.data[i * 4 + 3] = personMask.buffer[i];
                }
                maskCtx.putImageData(maskImageData, 0, 0);
                cutoutCtx.globalCompositeOperation = 'destination-in';
                cutoutCtx.drawImage(maskCanvas, 0, 0, cutoutCanvas.width, cutoutCanvas.height);
                ctx.drawImage(cutoutCanvas, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.drawImage(userImg, 0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(garmentImg, 0, 0, canvas.width, canvas.height);
        } catch(err) {
            console.error("Error drawing image:", err);
            setError("Could not compose the preview image.");
        } finally {
            setIsCompositing(false);
            setLoadingMessage('');
        }
    }, [data, selectedBg, config.backgroundImages]);

    const handleSelectBackground = (bgId: string) => {
        setEnhancedImageAvailable(false);
        setSelectedBg(bgId);
    };

    useEffect(() => {
        // Only run the local composition if an AI image hasn't replaced it.
        if (!enhancedImageAvailable) {
            drawCompositeImage();
        }
    }, [drawCompositeImage, enhancedImageAvailable]);

    const handleEnhanceWithAI = async () => {
        setIsEnhancing(true);
        setLoadingMessage('Applying AI magic...');
        setError(null);
    
        try {
            const { videoFrame, garmentOverlay, personMask, garment } = data;
            const bgChoice = config.backgroundImages.find(bg => bg.id === selectedBg);
    
            // Create a base image with the user on the selected background.
            const baseCanvas = document.createElement('canvas');
            const baseCtx = baseCanvas.getContext('2d');
            if (!baseCtx) throw new Error("Failed to create canvas context for AI base image.");
            const userImg = await loadImage(videoFrame);
            
            baseCanvas.width = userImg.width;
            baseCanvas.height = userImg.height;
    
            if (bgChoice && bgChoice.id !== 'original') {
                const bgImg = await loadImage(bgChoice.url);
                // Composite background and masked user
                const destRatio = baseCanvas.width / baseCanvas.height;
                const bgRatio = bgImg.width / bgImg.height;
                let sx = 0, sy = 0, sWidth = bgImg.width, sHeight = bgImg.height;
                if (bgRatio > destRatio) {
                    sWidth = sHeight * destRatio;
                    sx = (bgImg.width - sWidth) / 2;
                } else {
                    sHeight = sWidth / destRatio;
                    sy = (bgImg.height - sHeight) / 2;
                }
                baseCtx.drawImage(bgImg, sx, sy, sWidth, sHeight, 0, 0, baseCanvas.width, baseCanvas.height);
    
                const cutoutCanvas = document.createElement('canvas');
                cutoutCanvas.width = userImg.width;
                cutoutCanvas.height = userImg.height;
                const cutoutCtx = cutoutCanvas.getContext('2d')!;
                cutoutCtx.drawImage(userImg, 0, 0);
    
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = personMask.width;
                maskCanvas.height = personMask.height;
                const maskCtx = maskCanvas.getContext('2d')!;
                const maskImageData = maskCtx.createImageData(personMask.width, personMask.height);
                for (let i = 0; i < personMask.buffer.length; i++) {
                    maskImageData.data[i * 4 + 3] = personMask.buffer[i];
                }
                maskCtx.putImageData(maskImageData, 0, 0);
                cutoutCtx.globalCompositeOperation = 'destination-in';
                cutoutCtx.drawImage(maskCanvas, 0, 0, cutoutCanvas.width, cutoutCanvas.height);
                baseCtx.drawImage(cutoutCanvas, 0, 0, baseCanvas.width, baseCanvas.height);
            } else {
                baseCtx.drawImage(userImg, 0, 0, baseCanvas.width, baseCanvas.height);
            }
            
            const baseImageDataUrl = baseCanvas.toDataURL('image/jpeg');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const baseImagePart = { inlineData: { mimeType: 'image/jpeg', data: baseImageDataUrl.split(',')[1] } };

            let secondaryImagePart;
            let textPart;
            const refImageUrl = garment.refImageUrl;

            if (refImageUrl && refImageUrl.trim() !== '') {
                console.log("Using AI Reference Image for enhancement:", refImageUrl);
                const refImg = await loadImage(refImageUrl);
                const refCanvas = document.createElement('canvas');
                refCanvas.width = refImg.width;
                refCanvas.height = refImg.height;
                const refCtx = refCanvas.getContext('2d');
                if (!refCtx) throw new Error("Failed to create canvas context for reference image.");
                refCtx.drawImage(refImg, 0, 0);
                const refImageDataUrl = refCanvas.toDataURL('image/png');

                secondaryImagePart = { inlineData: { mimeType: 'image/png', data: refImageDataUrl.split(',')[1] } };
                
                const basePrompt = "You are a professional virtual stylist. Your task is to perform a digital clothes swap. The first image contains a person and a background. The second image is a reference photo of a clothing item. Take the clothing item from the second image and realistically dress the person in the first image with it. You must completely replace their original clothing.";
                const clothingDescription = garment.refImagePrompt ? `The clothing item to add is: ${garment.refImagePrompt}.` : "";
                const instructions = "The new garment must conform to the person's body shape and pose naturally. It is critically important to preserve the person's original face, hair, skin tone, and hands without any changes. The background from the first image must also be preserved perfectly. Ensure the lighting on the new garment matches the ambient lighting of the scene for a seamless, photorealistic result.";

                textPart = { text: `${basePrompt} ${clothingDescription} ${instructions}`.trim() };

            } else {
                console.log("Using 3D garment overlay for enhancement.");
                secondaryImagePart = { inlineData: { mimeType: 'image/png', data: garmentOverlay.split(',')[1] } };
                textPart = { text: "Analyze the person in the first image. Take the clothing item from the second image and realistically place it on the person, completely replacing their original clothes. The new garment should conform to their body shape and pose naturally. It is very important to NOT change the person's face, hair, skin tone, or hands. Keep the background exactly as it is in the first image. Ensure the lighting on the new garment matches the ambient lighting of the scene for a seamless blend." };
            }
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [baseImagePart, secondaryImagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });
    
            let foundImage = false;
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes = part.inlineData.data;
                    const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                    await drawFinalImageOnCanvas(imageUrl);
                    setEnhancedImageAvailable(true);
                    foundImage = true;
                    break;
                }
            }
    
            if (!foundImage) throw new Error("AI model did not return an image. Please try again.");
    
        } catch (err) {
            console.error("AI Enhancement failed:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred during AI enhancement.");
        } finally {
            setIsEnhancing(false);
            setLoadingMessage('');
        }
    };

    const handleContinue = () => {
        const canvas = previewCanvasRef.current;
        if (canvas) {
            onComplete(canvas.toDataURL('image/jpeg', 0.9));
        }
    };

    const isLoading = isCompositing || isEnhancing;

    return (
        <div className="w-full min-h-screen bg-black flex flex-col items-center p-4 lg:p-6 animate-page-fade-in overflow-y-auto">
            
            <header className="w-full max-w-7xl mx-auto flex justify-between items-center py-2 flex-shrink-0">
                <button onClick={onGoHome} className="flex items-center space-x-2 text-zinc-400 hover:text-white transition-colors">
                    <IconArrowLeft className="w-5 h-5" />
                    <span className="font-semibold">Back to Studio</span>
                </button>
                 <div className="text-center">
                    <h1 className="text-2xl lg:text-3xl font-bold text-white">Finalize Your Photo</h1>
                </div>
                <div className="w-44"></div>
            </header>
            
            <main className="flex-grow w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 mt-4">
                
                <div className="w-full lg:w-1/3 flex-shrink-0 flex justify-center lg:justify-end">
                    <div className="relative w-full max-w-sm aspect-[9/16] shadow-2xl rounded-2xl overflow-hidden bg-zinc-800">
                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                                <IconSpinner className="w-16 h-16 animate-spin text-lime-400" />
                                <p className="mt-4 text-zinc-300 font-semibold">{loadingMessage || 'Processing...'}</p>
                            </div>
                        )}
                        <canvas ref={previewCanvasRef} className="w-full h-full object-contain" />
                    </div>
                </div>

                <div className="w-full lg:w-2/3 glassmorphic p-6 lg:p-8 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold text-white">1. Choose a Background</h2>
                    <p className="text-zinc-400 text-sm mt-1">Select a new environment for your digital self.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {config.backgroundImages.map(bg => (
                           <BackgroundThumbnail 
                                key={bg.id}
                                bg={bg}
                                isSelected={selectedBg === bg.id}
                                onClick={() => handleSelectBackground(bg.id)}
                           />
                        ))}
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-white/10">
                        <h2 className="text-xl font-bold text-white">2. Blend with AI (Optional)</h2>
                        <p className="text-zinc-400 text-sm mt-1">Use generative AI to realistically blend the garment with your photo for a professional look.</p>
                        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
                        <button
                            onClick={handleEnhanceWithAI}
                            disabled={isLoading}
                            className="w-full mt-4 flex items-center justify-center space-x-3 bg-indigo-600 text-white font-bold py-4 px-6 rounded-xl text-lg
                                       transition-all duration-300 transform hover:scale-105 shadow-[0_8px_20px_rgba(99,102,241,0.35)]
                                       disabled:bg-indigo-600/50 disabled:text-white/50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100"
                        >
                             <IconSparkles className="w-6 h-6"/>
                             <span>{enhancedImageAvailable ? "Re-Enhance with AI" : "Enhance with AI"}</span>
                        </button>
                    </div>

                    <div className="mt-8">
                         <h2 className="text-xl font-bold text-white">3. Continue</h2>
                        <button 
                            onClick={handleContinue} 
                            disabled={isLoading}
                            className="w-full mt-4 flex items-center justify-center space-x-3 bg-lime-400 text-black font-bold py-4 px-6 rounded-xl text-lg
                                       transition-all duration-300 transform hover:scale-105 shadow-[0_8px_20px_rgba(163,230,53,0.35)]
                                       disabled:bg-lime-400/50 disabled:text-black/50 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100">
                            
                            <span>Continue to Share</span>
                        </button>
                    </div>
                </div>

            </main>
        </div>
    );
};

export default EditPage;