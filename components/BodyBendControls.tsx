import React, { useState, FC } from 'react';
import { IconRotate, IconChevronDown, IconReset } from './Icons';

// A re-usable slider component that displays a numerical value.
const ControlSlider: FC<{
    label: string;
    value: number;
    onValueChange: (newValue: number) => void;
    min: number;
    max: number;
    step: number;
    axis: 'x' | 'y' | 'z';
}> = ({ label, value, onValueChange, min, max, step, axis }) => {
    const axisColor = {
        x: 'text-red-400 accent-red-500',
        y: 'text-green-400 accent-green-500',
        z: 'text-blue-400 accent-blue-500',
    }[axis];

    return (
      <div className="flex items-center space-x-2">
        <span className={`text-xs font-mono w-4 ${axisColor}`}>{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          aria-label={`${label} axis slider`}
          className={`w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm ${axisColor}`}
        />
        <span className="text-xs font-mono w-12 text-right">{ value.toFixed(2) }</span>
      </div>
    );
};

export const BodyBendControls: FC<{
  upperBodyTarget: { x: number; y: number; z: number };
  bendIntensity: number;
  onTargetChange: (axis: 'x' | 'y' | 'z', value: number) => void;
  onIntensityChange: (value: number) => void;
  onReset: () => void;
}> = ({ upperBodyTarget, bendIntensity, onTargetChange, onIntensityChange, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
        <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72">
            <button 
                className="w-full flex justify-between items-center text-left"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <div className="flex items-center space-x-2">
                    <IconRotate className="w-5 h-5 text-amber-400"/>
                    <h3 className="text-sm font-bold">Body Bend Controls</h3>
                </div>
                <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="mt-4 space-y-3">
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                        <h4 className="font-semibold text-sm text-amber-300 mb-2">Bend Target Position</h4>
                        <p className="text-xs text-gray-400 mb-3">Relative to hips</p>
                        <div className="space-y-2">
                            <ControlSlider label="X" axis="x" value={upperBodyTarget.x} onValueChange={(val) => onTargetChange('x', val)} min={-2} max={2} step={0.05} />
                            <ControlSlider label="Y" axis="y" value={upperBodyTarget.y} onValueChange={(val) => onTargetChange('y', val)} min={-1} max={3} step={0.05} />
                            <ControlSlider label="Z" axis="z" value={upperBodyTarget.z} onValueChange={(val) => onTargetChange('z', val)} min={-2} max={2} step={0.05} />
                        </div>
                    </div>
                    <div className="p-3 bg-gray-800/50 rounded-lg">
                        <h4 className="font-semibold text-sm text-amber-300 mb-2">Bend Intensity</h4>
                        <ControlSlider label=" " axis="x" value={bendIntensity} onValueChange={onIntensityChange} min={0} max={1} step={0.01} />
                    </div>
                    <button
                        onClick={onReset}
                        className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <IconReset className="w-5 h-5"/>
                        <span>Reset Body Bend</span>
                    </button>
                </div>
            )}
        </div>
    );
};
