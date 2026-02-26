import React, { useState, FC } from 'react';
import { Adjustments } from '../types';
import { IconCube, IconReset, IconRotate, IconChevronDown, IconZoom, IconMove } from './Icons';

interface OccluderControlsProps {
  adjustments: Adjustments;
  onAdjustmentChange: (field: string, value: number) => void;
  onReset: () => void;
  isOccluderVisible: boolean;
  onToggleOccluder: () => void;
}

const ControlSlider: FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  step: number;
}> = ({ label, icon, value, onChange, min, max, step }) => (
  <div className="flex items-center space-x-3">
    <div className="text-gray-300 w-5 h-5 flex-shrink-0 flex items-center justify-center" title={label}>{icon}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      aria-label={label}
      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-lime-400"
    />
     <span className="text-xs font-mono text-gray-300 w-12 text-right flex-shrink-0">{value.toFixed(2)}</span>
  </div>
);

export const OccluderControls: FC<OccluderControlsProps> = ({ 
    adjustments, onAdjustmentChange, onReset, isOccluderVisible, onToggleOccluder 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72">
      <button 
        className="w-full flex justify-between items-center text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
            <IconCube className="w-5 h-5"/>
            <h3 className="text-sm font-bold">Occluder Controls</h3>
        </div>
        <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-4 space-y-4">
            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isOccluderVisible ? 'bg-lime-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'}`}>
                <span className="font-semibold text-sm">Visualize Occluder</span>
                <input
                    type="checkbox"
                    checked={isOccluderVisible}
                    onChange={onToggleOccluder}
                    className="sr-only"
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${isOccluderVisible ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${isOccluderVisible ? 'translate-x-5' : ''}`}/>
                </div>
            </label>
            
            <ControlSlider
                label="Scale (Zoom)"
                icon={<IconZoom className="w-5 h-5" />}
                value={adjustments.scale}
                onChange={(e) => onAdjustmentChange('scale', parseFloat(e.target.value))}
                min={0.5} max={4} step={0.05}
            />

            <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-2 text-gray-300">
                  <IconRotate className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase">Rotation</span>
              </div>
              <ControlSlider
                label="Occluder Rotation X"
                icon={<span className="font-mono text-red-400">X</span>}
                value={adjustments.rotation.x}
                onChange={(e) => onAdjustmentChange('rotation.x', parseFloat(e.target.value))}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
              <ControlSlider
                label="Occluder Rotation Y"
                icon={<span className="font-mono text-green-400">Y</span>}
                value={adjustments.rotation.y}
                onChange={(e) => onAdjustmentChange('rotation.y', parseFloat(e.target.value))}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
              <ControlSlider
                label="Occluder Rotation Z"
                icon={<span className="font-mono text-blue-400">Z</span>}
                value={adjustments.rotation.z}
                onChange={(e) => onAdjustmentChange('rotation.z', parseFloat(e.target.value))}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
          </div>

            <ControlSlider
                label="Horizontal Offset"
                icon={<IconMove className="w-5 h-5 transform rotate-90" />}
                value={adjustments.xOffset}
                onChange={(e) => onAdjustmentChange('xOffset', parseFloat(e.target.value))}
                min={-0.2} max={0.2} step={0.005}
            />
            <ControlSlider
                label="Vertical Offset"
                icon={<IconMove className="w-5 h-5" />}
                value={adjustments.yOffset}
                onChange={(e) => onAdjustmentChange('yOffset', parseFloat(e.target.value))}
                min={-0.2} max={0.2} step={0.005}
            />

          <button
            onClick={onReset}
            className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            <IconReset className="w-5 h-5"/>
            <span>Reset Occluder Adjustments</span>
          </button>
        </div>
      )}
    </div>
  );
};
