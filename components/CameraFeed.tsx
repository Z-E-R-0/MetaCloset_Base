import React, { useEffect, useRef, useState, FC, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PoseLandmarks, PoseLandmarkerResult, SegmentationData, SimpleMask } from '../types';
import { PoseLandmarker, ImageSegmenter, FilesetResolver, MPMask } from 'https://esm.sh/@mediapipe/tasks-vision@0.10.2';
import { calculateBoundingBoxFromMask } from './segmentation';
import { mediaPipeService } from './mediaPipeService';

interface CameraFeedProps {
  onLandmarks: (landmarks: PoseLandmarks) => void;
  onWorldLandmarks: (landmarks: PoseLandmarks) => void;
  onSegmentationData: (data: SegmentationData | null) => void;
  onSegmentationMask?: (mask: SimpleMask | null) => void;
  onError: (message: string) => void;
  isSegmentationActive: boolean;
  facingMode: 'user' | 'environment';
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(({ onLandmarks, onWorldLandmarks, onSegmentationData, onSegmentationMask, onError, isSegmentationActive, facingMode }, ref) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => internalVideoRef.current!, []);
  
  const animationFrameId = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const isFirstFrameProcessed = useRef(false);

  const isSegmentationActiveRef = useRef(isSegmentationActive);
  useEffect(() => {
    isSegmentationActiveRef.current = isSegmentationActive;
  }, [isSegmentationActive]);

  useEffect(() => {
    let isMounted = true;
    let stream: MediaStream | null = null;
    const videoElement = internalVideoRef.current;

    const setup = async () => {
      try {
        setLoadingMessage('Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: facingMode },
        });

        if (!isMounted || !videoElement) return;

        videoElement.srcObject = stream;
        videoElement.addEventListener('loadeddata', async () => {
          if (!isMounted) return;
          try {
            setLoadingMessage('Loading AI models (Pose & Segmentation)...');
            await mediaPipeService.initialize();
            const poseLandmarker = mediaPipeService.getPoseLandmarker();
            const imageSegmenter = mediaPipeService.getImageSegmenter();

            if (!isMounted) return;

            const processVideo = () => {
                if (!isMounted) return;
                const video = internalVideoRef.current;
                if (!video || video.paused || video.ended || !video.srcObject || !poseLandmarker || !imageSegmenter) {
                    animationFrameId.current = requestAnimationFrame(processVideo);
                    return;
                }
                const now = performance.now();
                if (video.currentTime !== lastVideoTimeRef.current) {
                    lastVideoTimeRef.current = video.currentTime;
                    
                    poseLandmarker.detectForVideo(video, now, (result: PoseLandmarkerResult) => {
                        if (result.landmarks && result.landmarks.length > 0) {
                            const landmarksCopy: PoseLandmarks = result.landmarks[0].map(lm => ({ ...lm }));
                            onLandmarks(landmarksCopy);
                             if (result.worldLandmarks && result.worldLandmarks.length > 0) {
                                const worldLandmarksCopy: PoseLandmarks = result.worldLandmarks[0].map(lm => ({ ...lm }));
                                onWorldLandmarks(worldLandmarksCopy);
                            } else {
                                onWorldLandmarks([]);
                            }
                            if (!isFirstFrameProcessed.current) {
                              setIsLoading(false);
                              isFirstFrameProcessed.current = true;
                            }
                        } else {
                            onLandmarks([]);
                            onWorldLandmarks([]);
                        }
                    });

                    if (isSegmentationActiveRef.current) {
                        imageSegmenter.segmentForVideo(video, now, (result) => {
                          if (result.confidenceMasks && result.confidenceMasks.length > 0) {
                            const mask = result.confidenceMasks[0];

                            // Convert float mask to a Uint8Array alpha mask for smoother blending.
                            const float32Array = mask.getAsFloat32Array();
                            const uint8Array = new Uint8Array(float32Array.length);
                            for (let i = 0; i < float32Array.length; i++) {
                                // The value is the probability, from 0.0 to 1.0.
                                // Convert it to a 0-255 alpha value.
                                uint8Array[i] = Math.round(float32Array[i] * 255);
                            }

                            const maskCopy: SimpleMask = {
                                buffer: uint8Array,
                                width: mask.width,
                                height: mask.height,
                            };
                            
                            // The bounding box calculation now uses the new alpha mask.
                            const bbox = calculateBoundingBoxFromMask(maskCopy);
                            onSegmentationData(bbox);
                            onSegmentationMask?.(maskCopy);
                          } else {
                            onSegmentationData(null);
                            onSegmentationMask?.(null);
                          }
                        });
                    } else {
                        onSegmentationData(null);
                        onSegmentationMask?.(null);
                    }
                }
                animationFrameId.current = requestAnimationFrame(processVideo);
            };
            processVideo();

          } catch (error: any) {
            console.error("Failed to initialize MediaPipe:", error);
            if (isMounted) onError('Failed to load AI model. Please refresh the page.');
          }
        });

      } catch (error: any) {
        console.error("Failed to initialize camera:", error);
        let errorMessage = 'Failed to access camera. It might be in use by another app or a refresh is needed.';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera access was denied. Please allow camera access in your browser settings and refresh the page.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera found. Please ensure a camera is connected and enabled.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera is already in use by another application or browser tab. Please close the other app and refresh.';
        } else if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            errorMessage = 'Camera took too long to start. This can happen if it\'s in use or the driver is slow. Please try refreshing the page.';
        }
        if (isMounted) onError(errorMessage);
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      stream?.getTracks().forEach(track => track.stop());
      if (videoElement) {
        videoElement.srcObject = null;
      }
      // The mediaPipeService is now managed globally and closed by ARExperience, so we don't close it here.
    };
  }, [onLandmarks, onWorldLandmarks, onSegmentationData, onSegmentationMask, onError, facingMode]);

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      {isLoading && (
        <div className="absolute z-20 flex flex-col items-center justify-center bg-gray-900/80 p-8 rounded-lg">
          <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-400"></div>
          <p className="mt-4 text-white">{loadingMessage}</p>
        </div>
      )}
      <video
        ref={internalVideoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />
    </div>
  );
});