import React, { FC, useState, useEffect } from 'react';
import { AppConfig } from '../types';

const GlitchText: FC<{ text: string; className?: string }> = ({ text, className }) => {
  return (
    <div className={`glitch ${className}`} data-text={text}>
      {text}
      <style>{`
        .glitch {
          position: relative;
          color: white;
          font-size: 8rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          animation: glitch-skew 1s infinite linear alternate-reverse;
        }
        .glitch::before,
        .glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #010101;
          overflow: hidden;
        }
        .glitch::before {
          left: 2px;
          text-shadow: -2px 0 #A3E635;
          animation: glitch-anim-1 2s infinite linear alternate-reverse;
        }
        .glitch::after {
          left: -2px;
          text-shadow: -2px 0 #4F46E5, 2px 2px #A3E635;
          animation: glitch-anim-2 3s infinite linear alternate-reverse;
        }

        @keyframes glitch-skew {
          0% { transform: skew(0deg); }
          5% { transform: skew(1deg); }
          10% { transform: skew(-0.5deg); }
          15% { transform: skew(0.2deg); }
          20% { transform: skew(0deg); }
          100% { transform: skew(0deg); }
        }
        @keyframes glitch-anim-1 {
          0% { clip-path: inset(10% 0 80% 0); }
          20% { clip-path: inset(50% 0 10% 0); }
          40% { clip-path: inset(25% 0 60% 0); }
          60% { clip-path: inset(80% 0 5% 0); }
          80% { clip-path: inset(40% 0 45% 0); }
          100% { clip-path: inset(90% 0 2% 0); }
        }
        @keyframes glitch-anim-2 {
          0% { clip-path: inset(85% 0 5% 0); }
          20% { clip-path: inset(20% 0 75% 0); }
          40% { clip-path: inset(65% 0 15% 0); }
          60% { clip-path: inset(5% 0 88% 0); }
          80% { clip-path: inset(55% 0 33% 0); }
          100% { clip-path: inset(70% 0 20% 0); }
        }
      `}</style>
    </div>
  );
};

interface IntroAnimationProps {
  onFinished: () => void;
  config: AppConfig;
}

export const IntroAnimation: FC<IntroAnimationProps> = ({ onFinished, config }) => {
  const [phase, setPhase] = useState('start');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('logo'), 100);
    const t2 = setTimeout(() => setPhase('end'), 3500);
    const t3 = setTimeout(onFinished, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinished]);
  
  const handleSkip = () => {
    setPhase('end');
    setTimeout(onFinished, 500);
  };

  return (
    <div className={`fixed inset-0 bg-[#010101] z-50 transition-opacity duration-500 ${phase === 'end' ? 'opacity-0' : 'opacity-100'}`}>
      <div className="relative w-full h-full flex items-center justify-center">
        <div className={`transition-opacity duration-500 ${phase === 'logo' ? 'opacity-100' : 'opacity-0'}`}>
            <GlitchText text="MetaCloset" />
        </div>
        <button
            onClick={handleSkip}
            className="absolute bottom-6 right-6 bg-black/20 text-white text-xs font-semibold py-2 px-4 rounded-full backdrop-blur-sm hover:bg-black/40 transition-all z-20"
        >
            Skip Intro
        </button>
      </div>
    </div>
  );
};