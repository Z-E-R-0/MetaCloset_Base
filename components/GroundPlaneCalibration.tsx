

import React, { FC, useState, useRef, useMemo, useCallback } from 'react';
import { PoseLandmarks } from '../types';
import * as THREE from 'three';
import { IconTarget, IconReset } from './Icons';

interface GroundPlaneCalibrationProps {
  onCalibrated: (plane: THREE.Plane) => void;
  landmarks: PoseLandmarks | null;
  worldLandmarks: PoseLandmarks | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const GroundPlaneCalibration: FC<GroundPlaneCalibrationProps> = ({ onCalibrated, landmarks, worldLandmarks, containerRef }) => {
    const [points2D, setPoints2D] = useState<Array<{x: number, y: number}>>([]);
    const [points3D, setPoints3D] = useState<Array<THREE.Vector3>>([]);
    
    const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (points2D.length >= 4) return;
        const container = containerRef.current;
        if (!landmarks || landmarks.length === 0 || !worldLandmarks || worldLandmarks.length === 0 || !container) {
            alert("Could not detect pose. Please make sure you are visible in the camera.");
            return;
        }

        const rect = container.getBoundingClientRect();
        // Click coordinates are normalized from 0 to 1 relative to the container
        const clickX = (event.clientX - rect.left) / rect.width;
        const clickY = (event.clientY - rect.top) / rect.height;

        // The video is flipped via CSS scale(-1, 1), so we must un-flip the x-coordinate for landmark matching.
        const normalizedClickX = 1 - clickX;
        
        let closestLmIndex = -1;
        let minDistance = Infinity;

        // Find the landmark closest to the click
        landmarks.forEach((lm, index) => {
            const distance = Math.hypot(lm.x - normalizedClickX, lm.y - clickY);
            if (distance < minDistance) {
                minDistance = distance;
                closestLmIndex = index;
            }
        });
        
        if (closestLmIndex !== -1 && worldLandmarks[closestLmIndex]) {
            const worldLm = worldLandmarks[closestLmIndex];
            
            // MediaPipe world landmarks are Y-up, X-right, Z-inward (right-handed)
            // We store the raw world landmark vector here. The transformation to Three.js space
            // will be handled in the GarmentOverlay component.
            const newPoint3D = new THREE.Vector3(worldLm.x, worldLm.y, worldLm.z);

            setPoints2D(prev => [...prev, { x: clickX, y: clickY }]);
            setPoints3D(prev => [...prev, newPoint3D]);
        }

    }, [landmarks, worldLandmarks, points2D.length, containerRef]);

    const handleReset = () => {
        setPoints2D([]);
        setPoints3D([]);
    };
    
    const handleConfirm = () => {
        if (points3D.length < 3) {
            alert("Please select at least 3 points on the ground.");
            return;
        }
        // Use the first 3 points to define the plane in the landmark's coordinate space
        const plane = new THREE.Plane().setFromCoplanarPoints(points3D[0], points3D[1], points3D[2]);
        onCalibrated(plane);
    };

    const isReadyForConfirm = points2D.length >= 3;

    return (
      <div 
        onClick={handleClick}
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-crosshair"
      >
        <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 text-center text-white mb-4 pointer-events-none">
            <h2 className="text-2xl font-bold text-amber-400">Step 1: Define the Ground</h2>
            <p className="mt-2 text-gray-300">Click on 4 corners of a rectangle on the ground in front of you.<br/> This will help anchor the model and reduce jitter.</p>
            <p className="mt-2 text-xl font-bold">{points2D.length} / 4 points selected</p>
        </div>

        <div className="w-full h-full absolute inset-0 pointer-events-none">
          {points2D.map((p, i) => (
             <div 
                key={i} 
                className="absolute w-5 h-5 bg-amber-400 border-2 border-white rounded-full flex items-center justify-center font-bold text-black text-sm"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%, -50%)'}}
              >
                {i + 1}
             </div>
          ))}
        </div>
        
         <div className="absolute bottom-6 flex space-x-4 pointer-events-auto">
             <button onClick={handleReset} className="flex items-center space-x-2 bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-3 px-6 rounded-xl transition-colors">
                <IconReset className="w-5 h-5"/>
                <span>Reset Points</span>
             </button>
             <button 
                onClick={handleConfirm} 
                disabled={!isReadyForConfirm}
                className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-6 rounded-xl transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                <IconTarget className="w-5 h-5"/>
                <span>Confirm Plane</span>
             </button>
         </div>

      </div>
    );
};