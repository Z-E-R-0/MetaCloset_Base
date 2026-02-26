import React from 'react';

const AnimatedGlow = () => {
    return (
        <svg viewBox="0 0 400 150" xmlns="http://www.w3.org/2000/svg" className="h-[9rem] md:h-[11rem] w-auto -mt-4 mb-4">
            <defs>
                {/* A filter to create the soft glow effect. We blur the text, then merge the original text back on top. */}
                <filter id="glow-filter" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {/* The text to be animated. It's invisible at first (fill="none") and will be "drawn" by its stroke. */}
            <text
                x="50%"
                y="55%" // Slightly adjusted for vertical alignment with 'Great Vibes' font
                dominantBaseline="middle"
                textAnchor="middle"
                className="glow-path"
                style={{ fontFamily: "'Great Vibes', cursive", fontSize: '120px' }}
                stroke="#D4AF37"
                strokeWidth="1.5"
                fill="none"
                filter="url(#glow-filter)"
            >
                Glow
            </text>
        </svg>
    );
};

export default AnimatedGlow;