import React, { useEffect, useRef, useState, useCallback } from 'react';

// A simple hook to get window dimensions.
const useWindow = () => {
  const [dimension, setDimension] = useState({width: 0, height: 0});

  const resize = () => {
    setDimension({
      width: window.innerWidth,
      height: window.innerHeight
    })
  }

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [])

  return { dimension }
}

const RevealEffect: React.FC = () => {
    const { dimension } = useWindow();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isInteracted, setIsInteracted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [maskUrl, setMaskUrl] = useState('');
    const animationFrameId = useRef<number | null>(null);

    // Function to update the mask URL from canvas
    const updateMask = useCallback(() => {
        if (canvasRef.current) {
            const dataUrl = canvasRef.current.toDataURL();
            setMaskUrl(dataUrl);
        }
    }, []);

    // Initial setup and resize handler
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || dimension.width === 0) return;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use a smaller canvas for performance; the mask will be scaled by CSS.
        canvas.width = dimension.width / 4;
        canvas.height = dimension.height / 4;
        
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-out";
        
        // Initial mask update
        updateMask();

    }, [dimension, updateMask]);

    const draw = (x: number, y: number, radius: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        
        // Scale coordinates and radius to the smaller canvas size
        const scaledX = x / 4;
        const scaledY = y / 4;
        const scaledRadius = radius / 4;

        ctx.beginPath();
        ctx.arc(scaledX, scaledY, scaledRadius, 0, 2 * Math.PI);
        ctx.fill();
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isInteracted) {
            setIsInteracted(true);
        }

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }

        animationFrameId.current = requestAnimationFrame(() => {
            const { clientX, clientY } = e;
            draw(clientX, clientY, 120); // Use a larger brush for a better feel
            updateMask();
        });
    };

    // After first interaction, fade out the overlay after a delay
    useEffect(() => {
        if (isInteracted) {
            const timer = setTimeout(() => {
                setIsFinished(true);
            }, 3000); // Start fading out 3 seconds after first interaction
            return () => clearTimeout(timer);
        }
    }, [isInteracted]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, []);
    
    // Fallback for when dimensions are not ready yet, to prevent content flash
    if (dimension.width === 0) {
        return <div className="fixed inset-0 bg-[#FDFBF6] z-[60]" />;
    }

    const maskStyle: React.CSSProperties = {
        maskImage: `url(${maskUrl})`,
        WebkitMaskImage: `url(${maskUrl})`,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
    };

    return (
        <>
            <div
                onMouseMove={handleMouseMove}
                className={`frosted-glass-shimmer fixed inset-0 z-[60] transition-opacity duration-1000 ease-in-out ${isFinished ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${isInteracted ? 'interacted' : ''}`}
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    ...maskStyle,
                }}
            >
              <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${isInteracted ? 'opacity-0' : 'opacity-100'}`}>
                  <h2 className="font-great-vibes text-5xl md:text-6xl text-zinc-800/70 select-none shadow-sm">
                      Swipe to reveal
                  </h2>
              </div>
            </div>
            {/* The canvas is now only for generating the mask data and can be hidden */}
            <canvas ref={canvasRef} className="hidden" />
        </>
    );
};

export default RevealEffect;