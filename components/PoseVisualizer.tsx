import React, { FC, useEffect, useRef } from 'react';
import { PoseLandmarks } from '../types';
import { POSE_CONNECTIONS } from '../constants';
import { remapLandmark } from './poseRetargeting';

interface PoseVisualizerProps {
  landmarks: PoseLandmarks | null;
  modelHipScreenPosition?: { x: number, y: number } | null;
  videoElement?: HTMLVideoElement | null;
  isFlipped?: boolean;
}

export const PoseVisualizer: FC<PoseVisualizerProps> = ({ landmarks, modelHipScreenPosition, videoElement, isFlipped: isFlippedProp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isFlipped = isFlippedProp ?? true;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Match canvas dimensions to its display size for accurate rendering
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) return;
    
    let processedLandmarks = landmarks;
    if (videoElement && videoElement.videoWidth > 0) {
        const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
        const canvasAspect = canvas.clientWidth / canvas.clientHeight;
        if (Math.abs(videoAspect - canvasAspect) > 0.01) {
            processedLandmarks = landmarks.map(lm => remapLandmark(lm, videoAspect, canvasAspect));
        }
    }


    // Draw connections (skeleton)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // White lines
    ctx.lineWidth = 3;
    
    POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const startLm = processedLandmarks[startIdx];
      const endLm = processedLandmarks[endIdx];

      if (startLm && endLm) {
        // Conditionally flip the x-coordinate for drawing based on the camera feed.
        const startX = (isFlipped ? 1 - startLm.x : startLm.x) * canvas.width;
        const startY = startLm.y * canvas.height;
        const endX = (isFlipped ? 1 - endLm.x : endLm.x) * canvas.width;
        const endY = endLm.y * canvas.height;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });

    // Draw landmarks (dots) on top of lines
    processedLandmarks.forEach((landmark, index) => {
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

      // Conditionally flip the x-coordinate to match the video feed.
      const x = (isFlipped ? 1 - landmark.x : landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI); // 5px radius circle
      ctx.fill();
    });

    // Draw debug line from user hip to model hip
    if (modelHipScreenPosition && processedLandmarks.length > 24) {
      const leftHip = processedLandmarks[23];
      const rightHip = processedLandmarks[24];

      if (leftHip && rightHip) {
        const userHipCenterX = (leftHip.x + rightHip.x) / 2;
        const userHipCenterY = (leftHip.y + rightHip.y) / 2;

        // User hip (start point) - needs to be flipped for display
        const startX = (isFlipped ? 1 - userHipCenterX : userHipCenterX) * canvas.width;
        const startY = userHipCenterY * canvas.height;

        // Model hip (end point) - is already in screen space, so we must flip it too.
        const endX = (isFlipped ? 1 - modelHipScreenPosition.x : modelHipScreenPosition.x) * canvas.width;
        const endY = modelHipScreenPosition.y * canvas.height;

        // Draw the line
        ctx.strokeStyle = 'magenta';
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]); // Dashed line to make it distinct

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.setLineDash([]); // Reset line dash

        // Draw a circle at the model's hip position for clarity
        ctx.fillStyle = 'magenta';
        ctx.beginPath();
        ctx.arc(endX, endY, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }, [landmarks, modelHipScreenPosition, videoElement, isFlipped]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-10 w-full h-full pointer-events-none" />;
};
