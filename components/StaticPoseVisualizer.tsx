import React, { FC, useEffect, useRef } from 'react';
import { PoseLandmarks } from '../types';
import { POSE_CONNECTIONS } from '../constants';

interface StaticPoseVisualizerProps {
  landmarks: PoseLandmarks | null;
  overlayStyle: React.CSSProperties;
  modelHipScreenPosition?: { x: number, y: number } | null;
}

export const StaticPoseVisualizer: FC<StaticPoseVisualizerProps> = ({ landmarks, overlayStyle, modelHipScreenPosition }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !overlayStyle.width || !overlayStyle.height) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match canvas dimensions to its container size for accurate rendering
    const width = parseInt(overlayStyle.width as string, 10);
    const height = parseInt(overlayStyle.height as string, 10);
    if (isNaN(width) || isNaN(height)) return;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) return;

    // Draw connections (skeleton)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // White lines
    ctx.lineWidth = 3;

    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const startLm = landmarks[startIdx];
        const endLm = landmarks[endIdx];
  
        if (startLm && endLm) {
          const startX = startLm.x * canvas.width;
          const startY = startLm.y * canvas.height;
          const endX = endLm.x * canvas.width;
          const endY = endLm.y * canvas.height;
  
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
    });

    // Draw landmarks (dots) on top of lines
    landmarks.forEach((landmark, index) => {
      if (!landmark) return;

      const isShoulder = index === 11 || index === 12;
      const isHip = index === 23 || index === 24;
      const isEar = index === 7 || index === 8;
      
      let color = 'rgba(0, 255, 255, 0.7)'; // Default: Cyan
      if (isShoulder) {
        color = 'rgba(50, 205, 50, 0.9)'; // Lime green for shoulders
      } else if (isHip) {
        color = 'rgba(255, 255, 0, 0.9)'; // Yellow for hips
      } else if (isEar) {
        color = 'rgba(255, 105, 180, 0.9)'; // Hot pink for ears
      }
      
      ctx.fillStyle = color;

      // The image is not flipped, so we use the landmark x-coordinate directly.
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI); // 5px radius circle
      ctx.fill();
    });

    // Draw debug line from user hip to model hip
    if (modelHipScreenPosition && landmarks.length > 24) {
      const leftHip = landmarks[23];
      const rightHip = landmarks[24];

      if (leftHip && rightHip) {
        const userHipCenterX = (leftHip.x + rightHip.x) / 2;
        const userHipCenterY = (leftHip.y + rightHip.y) / 2;

        // User hip (start point), not flipped
        const startX = userHipCenterX * canvas.width;
        const startY = userHipCenterY * canvas.height;

        // Model hip (end point), not flipped
        const endX = modelHipScreenPosition.x * canvas.width;
        const endY = modelHipScreenPosition.y * canvas.height;

        // Draw the line
        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.setLineDash([]);

        // Draw a circle at the model's hip position
        ctx.fillStyle = 'magenta';
        ctx.beginPath();
        ctx.arc(endX, endY, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

  }, [landmarks, overlayStyle, modelHipScreenPosition]);

  // The z-index of 10 places it above the image (z-0) but below the garment overlay (z-20)
  return <canvas ref={canvasRef} style={overlayStyle} className="absolute z-10 pointer-events-none" />;
};
