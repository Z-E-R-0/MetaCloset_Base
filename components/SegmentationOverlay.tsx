import React, { FC, useEffect, useRef } from 'react';
import { SimpleMask } from '../types';

interface SegmentationOverlayProps {
  mask: SimpleMask | null;
  // For static image, we need to match the image's rendered dimensions.
  overlayStyle?: React.CSSProperties; 
  // The camera feed is flipped, the static image is not.
  isFlipped?: boolean; 
}

// For visualization, we'll use a semi-transparent green.
const PERSON_COLOR = [0, 255, 0] as const; // Green

export const SegmentationOverlay: FC<SegmentationOverlayProps> = ({ mask, overlayStyle, isFlipped = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!mask) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // Determine the correct drawing dimensions
    let drawWidth: number, drawHeight: number;
    if (overlayStyle?.width && overlayStyle?.height) {
        // Static image case: use provided pixel dimensions
        drawWidth = parseInt(overlayStyle.width as string, 10);
        drawHeight = parseInt(overlayStyle.height as string, 10);
    } else {
        // Live feed case: use the dimensions of the parent container to avoid race conditions with clientWidth
        drawWidth = canvas.parentElement?.clientWidth || 0;
        drawHeight = canvas.parentElement?.clientHeight || 0;
    }

    // Abort if we have no valid drawing area
    if (isNaN(drawWidth) || isNaN(drawHeight) || drawWidth === 0 || drawHeight === 0) {
        return;
    }

    // Set canvas bitmap size to match its display size
    if (canvas.width !== drawWidth) canvas.width = drawWidth;
    if (canvas.height !== drawHeight) canvas.height = drawHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { buffer: maskBuffer, width: maskWidth, height: maskHeight } = mask;
    const imageData = ctx.createImageData(maskWidth, maskHeight);
    const data = imageData.data;

    for (let i = 0; i < maskBuffer.length; i++) {
        const alpha = maskBuffer[i]; // This is our 0-255 alpha value
        const pixelIndex = i * 4;
        data[pixelIndex] = PERSON_COLOR[0];     // R
        data[pixelIndex + 1] = PERSON_COLOR[1]; // G
        data[pixelIndex + 2] = PERSON_COLOR[2]; // B
        // Show a semi-transparent green overlay based on the mask's confidence
        data[pixelIndex + 3] = alpha * 0.5;
    }

    // Use a temporary canvas to draw the mask data, then scale it to the final canvas.
    // This correctly handles cases where the mask resolution differs from the display resolution.
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = maskWidth;
    tempCanvas.height = maskHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.putImageData(imageData, 0, 0);

    ctx.save();
    if (isFlipped) {
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);
    }
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();

  }, [mask, overlayStyle, isFlipped]);

  const finalStyle: React.CSSProperties = {
    ...overlayStyle,
    position: 'absolute',
    zIndex: 15,
    pointerEvents: 'none',
  };

  if (!overlayStyle) {
    finalStyle.inset = 0;
    finalStyle.width = '100%';
    finalStyle.height = '100%';
  }

  return <canvas ref={canvasRef} style={finalStyle} />;
};