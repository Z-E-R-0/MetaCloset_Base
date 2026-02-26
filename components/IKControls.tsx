import React, { useState, FC } from 'react';
import { ManualIKState } from '../types';
import { IconBug, IconChevronDown, IconReset } from './Icons';

interface IKControlsProps {
    ikState: ManualIKState;
    onStateChange: (field: string, value: any) => void;
    isLegTrackingEnabled: boolean;
    onLegTrackingToggle: () => void;
    positionRange?: { min: number; max: number; step: number; };
    rotationRange?: { min: number; max: number; step: number; };
    poleRange?: { min: number; max: number; step: number; };
}

type TargetName = keyof ManualIKState['targets'];
type PoleName = keyof ManualIKState['poleVectorOffsets'];

const IKSlider: FC<{
    label: string;
    value: number;
    onValueChange: (newValue: number) => void;
    min: number;
    max: number;
    step: number;
    axis: 'x' | 'y' | 'z';
    isAngle?: boolean;
}> = ({ label, value, onValueChange, min, max, step, axis, isAngle = true }) => {
    
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
        <span className="text-xs font-mono w-12 text-right text-gray-300">
            {isAngle ? `${(value * 180 / Math.PI).toFixed(0)}°` : value.toFixed(2)}
        </span>
      </div>
    );
};


const IKTargetControlGroup: FC<{
    targetName: string;
    targetKey: TargetName;
    values: { x: number; y: number; z: number };
    onStateChange: (field: string, value: any) => void;
    range: { min: number; max: number; step: number; };
}> = ({ targetName, targetKey, values, onStateChange, range }) => {
    return (
        <div className="p-3 bg-gray-800/50 rounded-lg">
            <h4 className="font-semibold text-sm text-amber-300 mb-2">{targetName}</h4>
            <div className="space-y-2">
                <IKSlider
                    label="X"
                    axis="x"
                    value={values.x}
                    onValueChange={(val) => onStateChange(`targets.${targetKey}.x`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
                <IKSlider
                    label="Y"
                    axis="y"
                    value={values.y}
                    onValueChange={(val) => onStateChange(`targets.${targetKey}.y`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
                <IKSlider
                    label="Z"
                    axis="z"
                    value={values.z}
                    onValueChange={(val) => onStateChange(`targets.${targetKey}.z`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
            </div>
        </div>
    );
};

const IKRotationControlGroup: FC<{
    jointName: string;
    jointKey: keyof ManualIKState['rotationOverrides'];
    values: { x: number; y: number; z: number };
    onStateChange: (field: string, value: any) => void;
    range: { min: number; max: number; step: number; };
}> = ({ jointName, jointKey, values, onStateChange, range }) => {
    return (
        <div className="p-3 bg-gray-800/50 rounded-lg">
            <h4 className="font-semibold text-sm text-amber-300 mb-2">{jointName} Rotation</h4>
            <div className="space-y-2">
                <IKSlider
                    label="X"
                    axis="x"
                    value={values.x}
                    onValueChange={(val) => onStateChange(`rotationOverrides.${jointKey}.x`, val)}
                    min={range.min} max={range.max} step={range.step}
                />
                <IKSlider
                    label="Y"
                    axis="y"
                    value={values.y}
                    onValueChange={(val) => onStateChange(`rotationOverrides.${jointKey}.y`, val)}
                    min={range.min} max={range.max} step={range.step}
                />
                <IKSlider
                    label="Z"
                    axis="z"
                    value={values.z}
                    onValueChange={(val) => onStateChange(`rotationOverrides.${jointKey}.z`, val)}
                    min={range.min} max={range.max} step={range.step}
                />
            </div>
        </div>
    );
};

const IKPoleControlGroup: FC<{
    poleName: string;
    poleKey: PoleName;
    values: { x: number; y: number; z: number };
    onStateChange: (field: string, value: any) => void;
    range: { min: number; max: number; step: number; };
}> = ({ poleName, poleKey, values, onStateChange, range }) => {
    return (
        <div className="p-3 bg-gray-800/50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm text-amber-300">{poleName}</h4>
                <button 
                    onClick={() => onStateChange(`poleVectorOffsets.${String(poleKey)}`, {x:0, y:0, z:0})}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                    title={`Reset ${poleName}`}
                >
                    <IconReset className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-2">
                <IKSlider
                    label="X"
                    axis="x"
                    value={values.x}
                    onValueChange={(val) => onStateChange(`poleVectorOffsets.${String(poleKey)}.x`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
                <IKSlider
                    label="Y"
                    axis="y"
                    value={values.y}
                    onValueChange={(val) => onStateChange(`poleVectorOffsets.${String(poleKey)}.y`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
                <IKSlider
                    label="Z"
                    axis="z"
                    value={values.z}
                    onValueChange={(val) => onStateChange(`poleVectorOffsets.${String(poleKey)}.z`, val)}
                    min={range.min} max={range.max} step={range.step}
                    isAngle={false}
                />
            </div>
        </div>
    );
};


export const IKControls: FC<IKControlsProps> = ({ 
    ikState, 
    onStateChange, 
    isLegTrackingEnabled, 
    onLegTrackingToggle, 
    positionRange, 
    rotationRange, 
    poleRange 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'position' | 'rotation' | 'pole' | 'body'>('position');

  const posRange = positionRange || { min: -700, max: 700, step: 10 };
  const rotRange = rotationRange || { min: -Math.PI, max: Math.PI, step: 0.05 };
  const polRange = poleRange || { min: -500, max: 500, step: 10 };

  return (
    <div className="bg-black/50 backdrop-blur-sm p-3 rounded-2xl shadow-lg text-white w-72">
      <button 
        className="w-full flex justify-between items-center text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
            <IconBug className="w-5 h-5 text-amber-400"/>
            <h3 className="text-sm font-bold">IK Live Controls</h3>
        </div>
        <IconChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-4 space-y-4">
            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${ikState.isEnabled ? 'bg-amber-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'}`}>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm">Manual Control</span>
              </div>
                <input
                    type="checkbox"
                    checked={ikState.isEnabled}
                    onChange={(e) => onStateChange('isEnabled', e.target.checked)}
                    className="sr-only"
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${ikState.isEnabled ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${ikState.isEnabled ? 'translate-x-5' : ''}`}/>
                </div>
            </label>

            <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${!ikState.isEnabled && isLegTrackingEnabled ? 'bg-amber-400/90 text-black' : 'bg-gray-700/60 hover:bg-gray-600/80 text-white'} ${ikState.isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm">Leg Tracking</span>
              </div>
                <input
                    type="checkbox"
                    checked={isLegTrackingEnabled}
                    onChange={onLegTrackingToggle}
                    className="sr-only"
                    disabled={ikState.isEnabled}
                />
                 <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${isLegTrackingEnabled ? 'bg-black/20' : 'bg-gray-500'}`}>
                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${isLegTrackingEnabled ? 'translate-x-5' : ''}`}/>
                </div>
            </label>
            
            <div className="flex bg-gray-700/60 rounded-lg p-1">
                <button 
                    onClick={() => setActiveTab('position')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'position' ? 'bg-amber-400 text-black' : 'text-white hover:bg-gray-600/80'}`}
                >
                    Position
                </button>
                 <button 
                    onClick={() => setActiveTab('body')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'body' ? 'bg-amber-400 text-black' : 'text-white hover:bg-gray-600/80'}`}
                >
                    Body Bend
                </button>
                <button 
                    onClick={() => setActiveTab('rotation')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'rotation' ? 'bg-amber-400 text-black' : 'text-white hover:bg-gray-600/80'}`}
                >
                    Rotation
                </button>
                 <button 
                    onClick={() => setActiveTab('pole')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'pole' ? 'bg-amber-400 text-black' : 'text-white hover:bg-gray-600/80'}`}
                >
                    Pole
                </button>
            </div>

            <div className={`${activeTab === 'position' ? 'block' : 'hidden'} space-y-3`}>
              <IKTargetControlGroup
                  targetName="Hips"
                  targetKey="hip"
                  values={ikState.targets.hip}
                  onStateChange={onStateChange}
                  range={posRange}
              />
              <IKTargetControlGroup
                  targetName="Left Hand"
                  targetKey="leftHand"
                  values={ikState.targets.leftHand}
                  onStateChange={onStateChange}
                  range={posRange}
              />
              <IKTargetControlGroup
                  targetName="Right Hand"
                  targetKey="rightHand"
                  values={ikState.targets.rightHand}
                  onStateChange={onStateChange}
                  range={posRange}
              />
              <IKTargetControlGroup
                  targetName="Left Foot"
                  targetKey="leftFoot"
                  values={ikState.targets.leftFoot}
                  onStateChange={onStateChange}
                  range={posRange}
              />
              <IKTargetControlGroup
                  targetName="Right Foot"
                  targetKey="rightFoot"
                  values={ikState.targets.rightFoot}
                  onStateChange={onStateChange}
                  range={posRange}
              />
              <button
                  onClick={() => onStateChange('resetTargets', null)}
                  className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                  <IconReset className="w-5 h-5"/>
                  <span>Reset Positions</span>
              </button>
            </div>
            
            <div className={`${activeTab === 'rotation' ? 'block' : 'hidden'} space-y-3`}>
                <IKRotationControlGroup
                    jointName="Hips"
                    jointKey="hips"
                    values={ikState.rotationOverrides.hips}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup
                    jointName="Spine"
                    jointKey="spine"
                    values={ikState.rotationOverrides.spine}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup
                    jointName="Spine 1"
                    jointKey="spine1"
                    values={ikState.rotationOverrides.spine1}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup
                    jointName="Spine 2"
                    jointKey="spine2"
                    values={ikState.rotationOverrides.spine2}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <div className="text-center text-xs text-gray-400 py-2">-- IK Chain Roots --</div>
                <IKRotationControlGroup 
                    jointName="Left Shoulder"
                    jointKey="leftShoulder"
                    values={ikState.rotationOverrides.leftShoulder}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup 
                    jointName="Right Shoulder"
                    jointKey="rightShoulder"
                    values={ikState.rotationOverrides.rightShoulder}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup 
                    jointName="Left Hip"
                    jointKey="leftHip"
                    values={ikState.rotationOverrides.leftHip}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <IKRotationControlGroup 
                    jointName="Right Hip"
                    jointKey="rightHip"
                    values={ikState.rotationOverrides.rightHip}
                    onStateChange={onStateChange}
                    range={rotRange}
                />
                <button
                    onClick={() => onStateChange('resetRotations', null)}
                    className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                    <IconReset className="w-5 h-5"/>
                    <span>Reset Rotations</span>
                </button>
            </div>

            <div className={`${activeTab === 'pole' ? 'block' : 'hidden'} space-y-3 max-h-[40vh] overflow-y-auto pr-2`}>
                <IKPoleControlGroup 
                    poleName="Left Elbow Pole"
                    poleKey="leftElbow"
                    values={ikState.poleVectorOffsets.leftElbow}
                    onStateChange={onStateChange}
                    range={polRange}
                />
                 <IKPoleControlGroup 
                    poleName="Right Elbow Pole"
                    poleKey="rightElbow"
                    values={ikState.poleVectorOffsets.rightElbow}
                    onStateChange={onStateChange}
                    range={polRange}
                />
                 <IKPoleControlGroup 
                    poleName="Left Knee Pole"
                    poleKey="leftKnee"
                    values={ikState.poleVectorOffsets.leftKnee}
                    onStateChange={onStateChange}
                    range={polRange}
                />
                 <IKPoleControlGroup 
                    poleName="Right Knee Pole"
                    poleKey="rightKnee"
                    values={ikState.poleVectorOffsets.rightKnee}
                    onStateChange={onStateChange}
                    range={polRange}
                />
                 <button
                  onClick={() => onStateChange('resetPoles', null)}
                  className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  <IconReset className="w-5 h-5"/>
                  <span>Reset All Poles</span>
              </button>
            </div>

            <div className={`${activeTab === 'body' ? 'block' : 'hidden'} space-y-3`}>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                    <h4 className="font-semibold text-sm text-amber-300 mb-2">Bend Target Position</h4>
                    <p className="text-xs text-gray-400 mb-3">Position is relative to the hip bone.</p>
                    <div className="space-y-2">
                        <IKSlider label="X" axis="x" value={ikState.upperBodyTarget.x} onValueChange={(val) => onStateChange('upperBodyTarget.x', val)} min={-2} max={2} step={0.05} isAngle={false} />
                        <IKSlider label="Y" axis="y" value={ikState.upperBodyTarget.y} onValueChange={(val) => onStateChange('upperBodyTarget.y', val)} min={-1} max={3} step={0.05} isAngle={false} />
                        <IKSlider label="Z" axis="z" value={ikState.upperBodyTarget.z} onValueChange={(val) => onStateChange('upperBodyTarget.z', val)} min={-2} max={2} step={0.05} isAngle={false} />
                    </div>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-lg">
                    <h4 className="font-semibold text-sm text-amber-300 mb-2">Bend Intensity</h4>
                     <IKSlider label=" " axis="x" value={ikState.bendIntensity} onValueChange={(val) => onStateChange('bendIntensity', val)} min={0} max={1} step={0.01} isAngle={false} />
                </div>
                <button
                  onClick={() => onStateChange('resetBodyBend', null)}
                  className="w-full mt-3 flex items-center justify-center space-x-2 bg-gray-700/60 hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                    <IconReset className="w-5 h-5"/>
                    <span>Reset Body Bend</span>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};