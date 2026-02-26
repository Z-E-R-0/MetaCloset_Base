import React, { FC, useRef, useEffect, useCallback, useState } from 'react';
import { Garment } from '../types';

interface ParallaxCarouselProps {
    garments: Garment[];
    onSelect: (garment: Garment) => void;
}

const ParallaxCarousel: FC<ParallaxCarouselProps> = ({ garments, onSelect }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [scrollPosition, setScrollPosition] = useState(0);
    // Initialize maxScroll to 1 to prevent division by zero issues before the component mounts.
    const [maxScroll, setMaxScroll] = useState(1);

    const handleParallax = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const items = container.querySelectorAll('.carousel-item');
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;

        items.forEach(item => {
            const itemEl = item as HTMLElement;
            const itemRect = itemEl.getBoundingClientRect();
            const itemCenter = itemRect.left + itemRect.width / 2;
            
            const distanceFromCenter = itemCenter - containerCenter;
            
            // Normalize distance to be between -1 and 1 for the visible part of the container
            const normalizedDistance = distanceFromCenter / (containerRect.width / 2);

            const scale = 1 - Math.min(Math.abs(normalizedDistance) * 0.25, 0.25);
            const rotation = normalizedDistance * -15; // Max rotation of 15 deg
            const opacity = 1 - Math.min(Math.abs(normalizedDistance) * 0.4, 0.5);
            const zIndex = 100 - Math.abs(Math.round(normalizedDistance * 10));

            itemEl.style.transform = `translateX(${distanceFromCenter * 0.1}px) rotateY(${rotation}deg) scale(${scale})`;
            itemEl.style.opacity = `${opacity}`;
            itemEl.style.zIndex = `${zIndex}`;
        });
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const updateMaxScroll = () => {
            const newMax = container.scrollWidth - container.clientWidth;
            // Only update if it's a valid, positive number
            if (newMax > 0) {
               setMaxScroll(newMax);
            }
        };

        const onScroll = () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            animationFrameRef.current = requestAnimationFrame(() => {
                handleParallax();
                if (container) {
                    setScrollPosition(container.scrollLeft);
                }
            });
        };
        
        // Use a ResizeObserver for more reliable updates on content/size changes
        const resizeObserver = new ResizeObserver(updateMaxScroll);
        resizeObserver.observe(container);

        container.addEventListener('scroll', onScroll, { passive: true });
        
        // Initial setup
        const initialLoadTimeout = setTimeout(() => {
            updateMaxScroll();
            handleParallax();
        }, 150); // Slightly increased delay for images to load

        return () => {
            container.removeEventListener('scroll', onScroll);
            resizeObserver.disconnect();
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            clearTimeout(initialLoadTimeout);
        };
    }, [handleParallax]);

    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = Number(event.target.value);
        }
    };

    return (
        <div>
            <div className="carousel-wrapper">
                <div ref={scrollContainerRef} className="carousel-container">
                    {garments.map((garment) => (
                        <button 
                            key={garment.id} 
                            className="carousel-item" 
                            onClick={() => onSelect(garment)}
                            aria-label={`Select ${garment.name}`}
                        >
                            <img src={garment.previewImageUrl} alt={garment.name} />
                            <h3>{garment.name}</h3>
                            <div className="carousel-item-highlight"></div>
                        </button>
                    ))}
                </div>
            </div>
             <div className="w-full max-w-md mx-auto px-4 mt-8">
                 <input
                    type="range"
                    min="0"
                    max={maxScroll}
                    value={scrollPosition}
                    onChange={handleSliderChange}
                    className="w-full h-2 bg-zinc-300 rounded-lg appearance-none cursor-pointer range-lg accent-[#D4AF37]"
                    aria-label="Scroll through garments"
                 />
            </div>
        </div>
    );
};

export default ParallaxCarousel;