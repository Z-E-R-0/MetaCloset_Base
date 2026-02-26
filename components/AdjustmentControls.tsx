import React, { useState, FC, useEffect, useRef } from 'react';
import { Adjustments } from '../types';
import { IconAdjustments, IconReset, IconZoom, IconRotate, IconMove, IconChevronDown, IconCube, IconEye, IconEyeSlash, IconSparkles } from './Icons';

interface AdjustmentControlsProps {
  adjustments: Adjustments;
  onAdjustmentChange: (field: string, value: number) => void;
  onReset: () => void;
  isDriverVisible?: boolean;
  onToggleDriverVisibility?: () => void;
  isRigged?: boolean;
  isSegmentationVisible?: boolean;
  onToggleSegmentationVisibility?: () => void;
  isPostProcessingEnabled?: boolean;
  onTogglePostProcessing?: () => void;
}

const ControlSlider: FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  onValueChange: (newValue: number) => void;
  min: number;
  max: number;
  step: number;
}> = ({ label, icon, value, onValueChange, min, max, step }) => {
  const [inputValue, setInputValue] = useState(value.toFixed(step < 1 ? 2 : 0));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // If the input is not focused, update its value from props.
    // This allows the slider to update the input box and also allows
    // resetting adjustments to work correctly.
    if (document.activeElement !== inputRef.current) {
      setInputValue(value.toFixed(step < 1 ? 2 : 0));
    }
  }, [value, step]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value); // Allow user to type freely
  };

  const handleInputBlur = () => {
    const parsedValue = parseFloat(inputValue);
    if (!isNaN(parsedValue)) {
      const clampedValue = Math.max(min, Math.min(max, parsedValue));
      onValueChange(clampedValue);
      setInputValue(clampedValue.toFixed(step < 1 ? 2 : 0));
    } else {
      // Revert to last known good value from props
      setInputValue(value.toFixed(step < 1 ? 2 : 0));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <div className="text-gray-300 w-5 h-5 flex-shrink-0 flex items-center justify-center" title={label}>{icon}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        aria-label={`${label} slider`}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm accent-amber-400"
      />
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        aria-label={`${label} value`}
        className="text-xs font-mono text-gray-300 w-16 text-right flex-shrink-0 bg-gray-700 border border-gray-600 rounded-md p-1 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400"
      />
    </div>
  );
};


export const AdjustmentControls: FC<AdjustmentControlsProps> = ({ 
  adjustments, onAdjustmentChange, onReset, isDriverVisible, onToggleDriverVisibility, isRigged,
  isSegmentationVisible, onToggleSegmentationVisibility, isPostProcessingEnabled, onTogglePostProcessing
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72">
      <button 
        className="w-full flex justify-between items-center text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
            <IconAdjustments className="w-5 h-5"/>
            <h3 className="text-sm font-bold">Adjustment Controls</h3>
        </div>
        <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-4 space-y-4">
          {onTogglePostProcessing && (
            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isPostProcessingEnabled ? 'bg-amber-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'}`}>
              <div className="flex items-center space-x-2">
                <IconSparkles className="w-5 h-5" />
                <span className="font-semibold text-sm">Post-Processing FX</span>
              </div>
                <input
                    type="checkbox"
                    checked={!!isPostProcessingEnabled}
                    onChange={onTogglePostProcessing}
                    className="sr-only"
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${isPostProcessingEnabled ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${isPostProcessingEnabled ? 'translate-x-5' : ''}`}/>
                </div>
            </label>
          )}
          {isRigged && onToggleDriverVisibility && (
            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isDriverVisible ? 'bg-amber-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'}`}>
              <div className="flex items-center space-x-2">
                <IconCube className="w-5 h-5" />
                <span className="font-semibold text-sm">Show Avatar</span>
              </div>
                <input
                    type="checkbox"
                    checked={isDriverVisible}
                    onChange={onToggleDriverVisibility}
                    className="sr-only"
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${isDriverVisible ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${isDriverVisible ? 'translate-x-5' : ''}`}/>
                </div>
            </label>
          )}

          {onToggleSegmentationVisibility && (
            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${isSegmentationVisible ? 'bg-amber-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'}`}>
              <div className="flex items-center space-x-2">
                {isSegmentationVisible ? <IconEye className="w-5 h-5" /> : <IconEyeSlash className="w-5 h-5" />}
                <span className="font-semibold text-sm">Show Segmentation</span>
              </div>
                <input
                    type="checkbox"
                    checked={!!isSegmentationVisible}
                    onChange={onToggleSegmentationVisibility}
                    className="sr-only"
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${isSegmentationVisible ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${isSegmentationVisible ? 'translate-x-5' : ''}`}/>
                </div>
            </label>
          )}

          <ControlSlider
            label="Scale (Zoom)"
            icon={<IconZoom className="w-5 h-5" />}
            value={adjustments.scale}
            onValueChange={(newValue) => onAdjustmentChange('scale', newValue)}
            min={0.5} max={4} step={0.05}
          />
          
          {/* Rotation Controls Group */}
          <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg">
              <div className="flex items-center space-x-2 text-gray-300">
                  <IconRotate className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase">Rotation</span>
              </div>
              <ControlSlider
                label="Rotation X"
                icon={<span className="font-mono text-red-400">X</span>}
                value={adjustments.rotation.x}
                onValueChange={(newValue) => onAdjustmentChange('rotation.x', newValue)}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
              <ControlSlider
                label="Rotation Y"
                icon={<span className="font-mono text-green-400">Y</span>}
                value={adjustments.rotation.y}
                onValueChange={(newValue) => onAdjustmentChange('rotation.y', newValue)}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
              <ControlSlider
                label="Rotation Z"
                icon={<span className="font-mono text-blue-400">Z</span>}
                value={adjustments.rotation.z}
                onValueChange={(newValue) => onAdjustmentChange('rotation.z', newValue)}
                min={-Math.PI} max={Math.PI} step={0.05}
              />
          </div>

          <ControlSlider
            label="Horizontal Offset"
            icon={<IconMove className="w-5 h-5 transform rotate-90" />}
            value={adjustments.xOffset}
            onValueChange={(newValue) => onAdjustmentChange('xOffset', newValue)}
            min={-1} max={1} step={0.01}
          />
          <ControlSlider
            label="Vertical Offset"
            icon={<IconMove className="w-5 h-5" />}
            value={adjustments.yOffset}
            onValueChange={(newValue) => onAdjustmentChange('yOffset', newValue)}
            min={-1} max={1} step={0.01}
          />
          {isRigged && (
            <ControlSlider
                label="Hip Height"
                icon={<IconMove className="w-5 h-5" />}
                value={adjustments.hipHeightOffset}
                onValueChange={(newValue) => onAdjustmentChange('hipHeightOffset', newValue)}
                min={-400} max={100} step={10}
            />
          )}
          <button
            onClick={onReset}
            className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
          >
            <IconReset className="w-5 h-5"/>
            <span>Reset Adjustments</span>
          </button>
        </div>
      )}
    </div>
  );
};