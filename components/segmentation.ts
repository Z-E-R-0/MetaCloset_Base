import { SegmentationData, SimpleMask } from '../types';

export const calculateBoundingBoxFromMask = (mask: SimpleMask): SegmentationData | null => {
    const { width, height, buffer } = mask;

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let hasPerson = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            // Use a threshold on the alpha mask. 128 is 50% opacity.
            if (buffer[index] > 128) {
                hasPerson = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (!hasPerson) {
        return null;
    }
    
    // Normalize coordinates
    const normWidth = (maxX - minX) / width;
    const normHeight = (maxY - minY) / height;
    const normCenterX = (minX + (maxX - minX) / 2) / width;
    const normCenterY = (minY + (maxY - minY) / 2) / height;

    return {
        centerX: normCenterX,
        centerY: normCenterY,
        width: normWidth,
        height: normHeight,
    };
};