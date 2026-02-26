import React, { FC } from 'react';

interface StatusIndicatorProps {
  isModelReady: boolean;
  isShoulderDetected: boolean;
  isHipDetected: boolean;
  hipDistance?: number | null;
  trackingMode?: '2D' | '3D';
}

const Indicator: FC<{ label: string; isActive: boolean }> = ({ label, isActive }) => (
  <div className="flex items-center space-x-2">
    <div
      className={`w-3 h-3 rounded-full transition-colors duration-200 ${isActive ? 'bg-amber-400' : 'bg-red-500'}`}
      role="status"
      aria-label={`${label} ${isActive ? 'active' : 'inactive'}`}
    ></div>
    <span className="text-sm font-medium">{label}</span>
  </div>
);

export const StatusIndicator: FC<StatusIndicatorProps> = ({ isModelReady, isShoulderDetected, isHipDetected, hipDistance, trackingMode }) => {
  return (
    <div className="bg-black/50 backdrop-blur-sm p-3 rounded-lg shadow-lg text-white min-w-[200px]" aria-live="polite">
      <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Body Tracking</h4>
      <div className="space-y-2">
        <Indicator label="Model Spawned" isActive={isModelReady} />
        <Indicator label="Shoulders Detected" isActive={isShoulderDetected} />
        <Indicator label="Hips Detected" isActive={isHipDetected} />
        {hipDistance !== null && hipDistance !== undefined && (
             <div className="flex items-center justify-between space-x-2 pt-1">
                <span className="text-sm font-medium">Hip Deviation</span>
                <span className={`text-sm font-mono px-2 py-0.5 rounded ${hipDistance < 0.05 ? 'bg-green-600/70' : hipDistance < 0.2 ? 'bg-yellow-600/70' : 'bg-red-600/70'}`}>
                    {hipDistance.toFixed(3)}
                </span>
             </div>
        )}
         {trackingMode && (
             <div className="flex items-center justify-between space-x-2 pt-1">
                <span className="text-sm font-medium">Pose Mode</span>
                <span className={`text-sm font-mono px-2 py-0.5 rounded ${trackingMode === '3D' ? 'bg-green-600/70' : 'bg-yellow-600/70'}`}>
                    {trackingMode}
                </span>
             </div>
        )}
      </div>
    </div>
  );
};