import React, { useState, FC } from 'react';
import { BoneAdjustments, BoneAdjustment } from '../types';
import { IconBug, IconChevronDown, IconReset } from './Icons';
import { DEBUGGABLE_BONES } from '../constants';

interface BoneDebugPaneProps {
  boneAdjustments: BoneAdjustments;
  onAdjustmentChange: (boneName: string, field: string, value: any) => void;
  onReset: () => void;
}

const BoneControl: FC<{
    boneName: string;
    adjustment: BoneAdjustment;
    onChange: BoneDebugPaneProps['onAdjustmentChange'];
}> = ({ boneName, adjustment, onChange }) => {
    
    const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
        onChange(boneName, `rotation.${axis}`, value);
    };

    const handleInvertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(boneName, 'isInverted', e.target.checked);
    };

    return (
        <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-sm text-lime-300">{boneName}</h4>
                <label className="flex items-center space-x-2 text-xs cursor-pointer text-gray-200 hover:text-white">
                    <input
                        type="checkbox"
                        checked={adjustment.isInverted}
                        onChange={handleInvertChange}
                        className="accent-lime-400 w-4 h-4 bg-gray-700 border-gray-500 rounded focus:ring-lime-500"
                    />
                    <span>Invert</span>
                </label>
            </div>
            <div className="space-y-2">
                 <div className="flex items-center space-x-2">
                     <span className="text-xs font-mono w-4 text-red-400">X</span>
                     <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={adjustment.rotation.x} onChange={(e) => handleRotationChange('x', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-red-500" />
                 </div>
                 <div className="flex items-center space-x-2">
                     <span className="text-xs font-mono w-4 text-green-400">Y</span>
                     <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={adjustment.rotation.y} onChange={(e) => handleRotationChange('y', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-green-500" />
                 </div>
                 <div className="flex items-center space-x-2">
                     <span className="text-xs font-mono w-4 text-blue-400">Z</span>
                     <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={adjustment.rotation.z} onChange={(e) => handleRotationChange('z', parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm accent-blue-500" />
                 </div>
            </div>
        </div>
    );
};

export const BoneDebugPane: FC<BoneDebugPaneProps> = ({ boneAdjustments, onAdjustmentChange, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72 max-h-[40vh] overflow-y-auto">
             <button 
                className="w-full flex justify-between items-center text-left mb-2"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <div className="flex items-center space-x-2">
                    <IconBug className="w-5 h-5 text-lime-400"/>
                    <h3 className="text-sm font-bold">Bone Debug Controls</h3>
                </div>
                <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className='space-y-3'>
                    {DEBUGGABLE_BONES.map(boneName => (
                       <BoneControl
                            key={boneName}
                            boneName={boneName}
                            adjustment={boneAdjustments[boneName]}
                            onChange={onAdjustmentChange}
                       /> 
                    ))}
                    <button
                        onClick={onReset}
                        className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        <IconReset className="w-5 h-5"/>
                        <span>Reset Bone Adjustments</span>
                    </button>
                </div>
            )}
        </div>
    );
};