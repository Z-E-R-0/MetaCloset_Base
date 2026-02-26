import React, { useState, FC } from 'react';
import { IKRotationOverrides } from '../types';
import { IconRotate, IconChevronDown, IconReset } from './Icons';

// Re-usable slider component.
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
        <span className="text-xs font-mono w-12 text-right">{ (value * 180 / Math.PI).toFixed(0) }°</span>
      </div>
    );
};

// Re-usable control group for a single bone's rotation.
const RotationControlGroup: FC<{
    jointName: string;
    jointKey: keyof IKRotationOverrides;
    values: { x: number; y: number; z: number };
    onRotationChange: (bone: keyof IKRotationOverrides, axis: 'x' | 'y' | 'z', value: number) => void;
    range: { min: number; max: number; step: number; };
}> = ({ jointName, jointKey, values, onRotationChange, range }) => {
    return (
        <div className="p-3 bg-gray-800/50 rounded-lg">
            <h4 className="font-semibold text-sm text-amber-300 mb-2">{jointName}</h4>
            <div className="space-y-2">
                <ControlSlider
                    label="X"
                    axis="x"
                    value={values.x}
                    onValueChange={(val) => onRotationChange(jointKey, 'x', val)}
                    min={range.min} max={range.max} step={range.step}
                />
                <ControlSlider
                    label="Y"
                    axis="y"
                    value={values.y}
                    onValueChange={(val) => onRotationChange(jointKey, 'y', val)}
                    min={range.min} max={range.max} step={range.step}
                />
                <ControlSlider
                    label="Z"
                    axis="z"
                    value={values.z}
                    onValueChange={(val) => onRotationChange(jointKey, 'z', val)}
                    min={range.min} max={range.max} step={range.step}
                />
            </div>
        </div>
    );
};


export const TorsoControls: FC<{
  rotationOverrides: IKRotationOverrides;
  onRotationChange: (bone: keyof IKRotationOverrides, axis: 'x' | 'y' | 'z', value: number) => void;
  onReset: () => void;
}> = ({ rotationOverrides, onRotationChange, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);
    const rotRange = { min: -Math.PI, max: Math.PI, step: 0.05 };

    return (
        <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72">
            <button 
                className="w-full flex justify-between items-center text-left"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <div className="flex items-center space-x-2">
                    <IconRotate className="w-5 h-5 text-amber-400"/>
                    <h3 className="text-sm font-bold">Torso Controls</h3>
                </div>
                <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="mt-4 space-y-3">
                    <RotationControlGroup
                        jointName="Hips"
                        jointKey="hips"
                        values={rotationOverrides.hips}
                        onRotationChange={onRotationChange}
                        range={rotRange}
                    />
                    <RotationControlGroup
                        jointName="Lower Torso"
                        jointKey="spine"
                        values={rotationOverrides.spine}
                        onRotationChange={onRotationChange}
                        range={rotRange}
                    />
                    <RotationControlGroup
                        jointName="Mid Torso"
                        jointKey="spine1"
                        values={rotationOverrides.spine1}
                        onRotationChange={onRotationChange}
                        range={rotRange}
                    />
                    <RotationControlGroup
                        jointName="Chest"
                        jointKey="spine2"
                        values={rotationOverrides.spine2}
                        onRotationChange={onRotationChange}
                        range={rotRange}
                    />
                    <button
                        onClick={onReset}
                        className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <IconReset className="w-5 h-5"/>
                        <span>Reset Torso</span>
                    </button>
                </div>
            )}
        </div>
    );
};
