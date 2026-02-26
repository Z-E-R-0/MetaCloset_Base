import React, { useRef, useEffect } from 'react';
import { PoseLandmarks } from '../types';

// MediaPipe Pose 33-landmark connections for skeleton overlay (start, end) indices
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // shoulders, arms
  [11, 23], [12, 24], [23, 24],                       // torso
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],  // left leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],  // right leg
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], // face
];

interface PoseSkeletonCanvasProps {
  landmarks: PoseLandmarks | null;
  videoWidth: number;
  videoHeight: number;
  visible: boolean;
  className?: string;
}

export const PoseSkeletonCanvas: React.FC<PoseSkeletonCanvasProps> = ({
  landmarks,
  videoWidth,
  videoHeight,
  visible,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !landmarks || landmarks.length < 33) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Landmarks are normalized (0-1), scale to canvas
    const scaleX = w;
    const scaleY = h;

    const drawX = (lm: { x: number }) => lm.x * scaleX;
    const drawY = (lm: { y: number }) => lm.y * scaleY;

    // Draw connections first
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.9)';
    ctx.lineWidth = 2;
    for (const [i, j] of POSE_CONNECTIONS) {
      if (i >= landmarks.length || j >= landmarks.length) continue;
      const a = landmarks[i];
      const b = landmarks[j];
      if (a.visibility !== undefined && a.visibility < 0.5) continue;
      if (b.visibility !== undefined && b.visibility < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(drawX(a), drawY(a));
      ctx.lineTo(drawX(b), drawY(b));
      ctx.stroke();
    }

    // Draw landmark points
    ctx.fillStyle = 'rgba(255, 100, 100, 0.95)';
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.visibility !== undefined && lm.visibility < 0.5) continue;
      const x = drawX(lm);
      const y = drawY(lm);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, visible, videoWidth, videoHeight]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        pointerEvents: 'none',
      }}
    />
  );
};
