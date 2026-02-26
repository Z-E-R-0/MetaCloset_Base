import React, { useState, useCallback, useMemo, FC, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { CameraFeed } from '../components/CameraFeed';
import { GarmentOverlay, GarmentOverlayHandles } from '../components/GarmentOverlay';
import { PoseVisualizer } from '../components/PoseVisualizer';
import { PoseLandmarks, Garment, SegmentationData, SimpleMask, EditPageData, UserRestPose, AppConfig, IKRotationOverrides, Accessory, Avatar, FirebaseUser } from '../types';
import { TrackingIndicator } from '../components/TrackingIndicator';
import { IconArrowLeft, IconCamera, IconSpinner, IconCube, IconCheck, IconSwitchCamera, IconJewelry, IconShirt, IconSparkles } from '../components/Icons';
import { StatusIndicator } from '../components/StatusIndicator';
import { mediaPipeService } from '../components/mediaPipeService';
import { TorsoControls } from '../components/TorsoControls';
import { RotationControl } from '../components/RotationControl';
import { calculateUserRestPose } from '../components/poseRetargeting';
import { BodyBendControls } from '../components/BodyBendControls';
import { AccessorySelector } from '../components/AccessorySelector';
import { GarmentSelector } from '../components/GarmentSelector';


interface ARExperienceProps {
  garment: Garment;
  avatar: Avatar;
  onGoHome: () => void;
  onNavigateToEdit: (data: EditPageData) => void;
  config: AppConfig;
  currentUser: FirebaseUser | null;
  onRequestLogin: () => void;
}

const radToDeg = (r: number) => r * 180 / Math.PI;

const initialRotationOverrides: IKRotationOverrides = {
  leftShoulder: { x: 0, y: 0, z: 0 },
  rightShoulder: { x: 0, y: 0, z: 0 },
  leftHip: { x: 0, y: 0, z: 0 },
  rightHip: { x: 0, y: 0, z: 0 },
  hips: { x: 0, y: 0, z: 0 },
  spine: { x: 0, y: 0, z: 0 },
  spine1: { x: 0, y: 0, z: 0 },
  spine2: { x: 0, y: 0, z: 0 },
};

const ToggleSwitch: FC<{ label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, icon?: React.ReactNode }> = ({ label, checked, onChange, icon }) => (
    <label className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-lime-400/90 text-black' : 'bg-zinc-700/60 hover:bg-zinc-600/80 text-white'}`}>
        <div className="flex items-center space-x-2">
            {icon}
            <span className="font-semibold text-sm">{label}</span>
        </div>
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <div className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ${checked ? 'bg-black/20' : 'bg-zinc-500'}`}>
            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ${checked ? 'translate-x-5' : ''}`} />
        </div>
    </label>
);

// EMA (Exponential Moving Average) filter for smoothing landmark data.
const applyEmaSmoothing = (
    newValues: PoseLandmarks, 
    prevSmoothedValues: PoseLandmarks | null, 
    alpha: number
): PoseLandmarks => {
    if (!prevSmoothedValues || newValues.length !== prevSmoothedValues.length) {
        return newValues.map(lm => ({ ...lm })); // Return a fresh copy
    }
    
    const smoothed = newValues.map((newValue, i) => {
        const prevSmoothed = prevSmoothedValues[i];
        if (!prevSmoothed) return { ...newValue };
        return {
            x: alpha * newValue.x + (1 - alpha) * prevSmoothed.x,
            y: alpha * newValue.y + (1 - alpha) * prevSmoothed.y,
            z: alpha * newValue.z + (1 - alpha) * prevSmoothed.z,
            visibility: newValue.visibility, // Use latest visibility
        };
    });
    
    return smoothed;
};


const ARExperience: FC<ARExperienceProps> = ({ garment: initialGarment, avatar, onGoHome, onNavigateToEdit, config, currentUser, onRequestLogin }) => {
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [worldLandmarks, setWorldLandmarks] = useState<PoseLandmarks | null>(null);
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null);
  const [segmentationMask, setSegmentationMask] = useState<SimpleMask | null>(null);
  
  const [userRestPose, setUserRestPose] = useState<UserRestPose | null>(null);

  const [currentGarment, setCurrentGarment] = useState<Garment>(initialGarment);
  const isRigged = useMemo(() => currentGarment.isRigged || false, [currentGarment]);
  
  const [isModelReady, setIsModelReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  
  const [debugData, setDebugData] = useState<{ modelHipScreenPosition: {x:number, y:number} | null; hipDistance: number | null; }>({ modelHipScreenPosition: null, hipDistance: null });
  const [error, setError] = useState<string | null>(null);

  const [showFlash, setShowFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const [isAvatarDebugVisible, setIsAvatarDebugVisible] = useState(false);
  const [showPoseLoadedToast, setShowPoseLoadedToast] = useState(false);
  const [ikRotationOverrides, setIkRotationOverrides] = useState<IKRotationOverrides>(initialRotationOverrides);
  const [estimatedLighting, setEstimatedLighting] = useState({ 
    key: { r: 1, g: 1, b: 1, intensity: 1.2, x: 1.5 }, 
    fill: { r: 1, g: 1, b: 1, intensity: 0.6, x: -1.5 }, 
    ambient: { r: 1, g: 1, b: 1, intensity: 0.5 },
    hdriIntensity: 0.5,
  });

  const [upperBodyTarget, setUpperBodyTarget] = useState(config.defaultIKPose?.upperBodyTarget || { x: 0, y: 2, z: -1 });
  const [bendIntensity, setBendIntensity] = useState(config.defaultIKPose?.bendIntensity || 0.0);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [isAutoRotating, setIsAutoRotating] = useState(false);

  const [isDevModeVisible, setIsDevModeVisible] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'2D' | '3D'>('2D');
  
  const [selectedAccessory, setSelectedAccessory] = useState<Accessory | null>(null);
  const [isAccessoryPanelOpen, setIsAccessoryPanelOpen] = useState(false);
  const [isGarmentPanelOpen, setIsGarmentPanelOpen] = useState(false);
  
  const [loadingGarmentId, setLoadingGarmentId] = useState<string | null>(null);
  const [loadedGarmentIds, setLoadedGarmentIds] = useState<Set<string>>(() => new Set([initialGarment.id]));

  const [loadingAccessoryId, setLoadingAccessoryId] = useState<string | null>(null);
  const [loadedAccessoryIds, setLoadedAccessoryIds] = useState<Set<string>>(new Set());

  const [isPostProcessingEnabled, setIsPostProcessingEnabled] = useState(true);


  const videoRef = useRef<HTMLVideoElement>(null);
  const garmentOverlayRef = useRef<GarmentOverlayHandles>(null);
  const experienceContainerRef = useRef<HTMLDivElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Refs for smoothing and auto-calibration
  const smoothedLandmarksRef = useRef<PoseLandmarks | null>(null);
  const smoothedWorldLandmarksRef = useRef<PoseLandmarks | null>(null);
  const calibrationAttemptedRef = useRef(false);
  const landmarksRef = useRef<PoseLandmarks | null>(null);
  landmarksRef.current = landmarks;
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => {
    // After the model has loaded, if the user is not logged in,
    // wait 3 seconds and then prompt them to sign in.
    if (isModelReady && !currentUser) {
        const timer = setTimeout(() => {
            // Check again in case the user logged in during the 3-second delay
            if (!currentUserRef.current) {
                onRequestLogin();
            }
        }, 3000);

        return () => clearTimeout(timer);
    }
  }, [isModelReady, currentUser, onRequestLogin]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault();
        setIsDevModeVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    // When this component unmounts, clean up the shared MediaPipe service.
    if (config.defaultIKPose) {
        setShowPoseLoadedToast(true);
    }

    const getDevices = async () => {
        try {
            // We need to get permissions first to get a full device list with labels.
            // The CameraFeed component will handle the actual permission prompt.
            await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            setVideoDevices(videoInputs);
        } catch (err) {
            // This error is expected if the user denies permission, so we'll just log a warning.
            console.warn("Could not enumerate devices (this can happen if permissions are not granted):", err);
        }
    };
    getDevices();

    return () => {
        mediaPipeService.close();
    }
  }, [config.defaultIKPose]);

  // --- Real-time Light & Color Estimation ---
  useEffect(() => {
    tempCanvasRef.current = document.createElement('canvas');
    tempCanvasRef.current.width = 64;
    tempCanvasRef.current.height = 64;

    const intervalId = setInterval(() => {
        if (!videoRef.current || !landmarks || landmarks.length < 13) return;
        
        const video = videoRef.current;
        const canvas = tempCanvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        
        // Draw the raw, unflipped video frame for consistent analysis
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const getAverageColorAndLuminance = (landmarkIndex: number, sampleSize = 5): { r: number, g: number, b: number, lum: number } => {
            const lm = landmarks[landmarkIndex];
            if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return { r: 0.5, g: 0.5, b: 0.5, lum: 128 };

            const sampleX = Math.floor(lm.x * canvas.width);
            const sampleY = Math.floor(lm.y * canvas.height);
            
            const halfSize = Math.floor(sampleSize / 2);
            let r = 0, g = 0, b = 0, count = 0;

            for (let y = -halfSize; y <= halfSize; y++) {
                for (let x = -halfSize; x <= halfSize; x++) {
                    const pixelX = THREE.MathUtils.clamp(sampleX + x, 0, canvas.width - 1);
                    const pixelY = THREE.MathUtils.clamp(sampleY + y, 0, canvas.height - 1);
                    const pixelIndex = (pixelY * canvas.width + pixelX) * 4;
                    r += data[pixelIndex];
                    g += data[pixelIndex + 1];
                    b += data[pixelIndex + 2];
                    count++;
                }
            }
            
            if (count === 0) return { r: 0.5, g: 0.5, b: 0.5, lum: 128 };
            
            const avgR = r / count;
            const avgG = g / count;
            const avgB = b / count;
            const lum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

            return { r: avgR / 255, g: avgG / 255, b: avgB / 255, lum };
        };

        const leftShoulderData = getAverageColorAndLuminance(11);
        const rightShoulderData = getAverageColorAndLuminance(12);
        const faceData = getAverageColorAndLuminance(0);

        if (leftShoulderData.lum + rightShoulderData.lum + faceData.lum < 15) return;

        // The model mirrors the user. If user's left is brighter, model's right (+x) should be lit.
        const lightXDirection = leftShoulderData.lum > rightShoulderData.lum ? 1 : -1;

        const keyLum = Math.max(leftShoulderData.lum, rightShoulderData.lum);
        const fillLum = Math.min(leftShoulderData.lum, rightShoulderData.lum);
        const avgLum = (leftShoulderData.lum + rightShoulderData.lum + faceData.lum) / 3;

        const keyIntensity = THREE.MathUtils.mapLinear(keyLum, 40, 230, 0.8, 2.2);
        const contrast = keyLum / (fillLum + 1e-6);
        const fillIntensity = THREE.MathUtils.clamp(keyIntensity / (contrast * 1.5), 0.2, keyIntensity * 0.7);
        const ambientIntensity = THREE.MathUtils.clamp(0.4 + (avgLum / 255) * 0.5, 0.4, 0.8);

        const keyColor = { r: faceData.r, g: faceData.g, b: faceData.b };
        const fillColorData = lightXDirection === 1 ? rightShoulderData : leftShoulderData;
        const fillColor = { r: fillColorData.r, g: fillColorData.g, b: fillColorData.b };
        const ambientColor = {
            r: (leftShoulderData.r + rightShoulderData.r + faceData.r) / 3,
            g: (leftShoulderData.g + rightShoulderData.g + faceData.g) / 3,
            b: (leftShoulderData.b + rightShoulderData.b + faceData.b) / 3,
        };
        
        const hdriIntensity = THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(avgLum, 30, 220, 0.4, 0.9), 0.3, 1.0);

        setEstimatedLighting({
            key: { ...keyColor, intensity: keyIntensity, x: lightXDirection * 1.5 },
            fill: { ...fillColor, intensity: fillIntensity, x: -lightXDirection * 1.5 },
            ambient: { ...ambientColor, intensity: ambientIntensity },
            hdriIntensity: hdriIntensity,
        });

    }, 500); // Check lighting conditions twice a second

    return () => clearInterval(intervalId);
  }, [landmarks]);

  // Auto-calibration effect
  useEffect(() => {
    // Conditions to start the calibration timer:
    // 1. We are using a rigged garment.
    // 2. A pose has been detected.
    // 3. We have not attempted calibration yet.
    if (isRigged && landmarks && landmarks.length > 0 && !calibrationAttemptedRef.current) {
      // Mark that we are attempting calibration so this doesn't run again.
      calibrationAttemptedRef.current = true;

      console.log("Pose detected. Starting auto-calibration timer...");
      
      const timerId = setTimeout(() => {
        // When the timer fires, use the most recent landmarks available.
        if (landmarksRef.current) {
          console.log("Auto-calibrating with captured pose.");
          const restPose = calculateUserRestPose(landmarksRef.current);
          setUserRestPose(restPose);
        } else {
          console.warn("Calibration failed: Landmarks lost before timer fired.");
          // Allow for another attempt if landmarks are re-acquired.
          calibrationAttemptedRef.current = false;
        }
      }, 2000); // A 2-second delay to auto-capture.
    }
  }, [isRigged, landmarks]);

  const handleRotationChange = useCallback((bone: keyof IKRotationOverrides, axis: 'x' | 'y' | 'z', value: number) => {
    setIkRotationOverrides(prev => ({
      ...prev,
      [bone]: {
        ...prev[bone],
        [axis]: value
      }
    }));
  }, []);

  const handleResetRotations = useCallback(() => {
      setIkRotationOverrides(initialRotationOverrides);
  }, []);
  
  const handleTargetChange = useCallback((axis: 'x' | 'y' | 'z', value: number) => {
    setUpperBodyTarget(prev => ({ ...prev, [axis]: value }));
  }, []);

  const handleIntensityChange = useCallback((value: number) => {
      setBendIntensity(value);
  }, []);

  const handleResetBend = useCallback(() => {
      setUpperBodyTarget({ x: 0, y: 2, z: -1 });
      setBendIntensity(0.0);
  }, []);

  const handleSwitchCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCapturePhoto = async () => {
    const video = videoRef.current;
    const garmentCanvas = garmentOverlayRef.current?.getCanvas();

    if (!video || !garmentCanvas || video.videoWidth === 0) {
      console.error("Capture failed: Video or Garment canvas not ready.");
      return;
    }
    
    setIsCapturing(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);

    try {
        // 1. Create a canvas that captures the exact on-screen view
        const screenWidth = video.clientWidth;
        const screenHeight = video.clientHeight;
        const screenViewCanvas = document.createElement('canvas');
        screenViewCanvas.width = screenWidth;
        screenViewCanvas.height = screenHeight;
        const screenViewCtx = screenViewCanvas.getContext('2d');
        if (!screenViewCtx) return;

        // 2. Draw the video onto it, replicating `object-fit: cover`
        const videoRatio = video.videoWidth / video.videoHeight;
        const screenRatio = screenWidth / screenHeight;
        let videoSx, videoSy, videoSWidth, videoSHeight;
        if (videoRatio > screenRatio) { // Video is wider than screen, so crop video's sides
            videoSHeight = video.videoHeight;
            videoSWidth = videoSHeight * screenRatio;
            videoSx = (video.videoWidth - videoSWidth) / 2;
            videoSy = 0;
        } else { // Video is taller than screen, so crop video's top/bottom
            videoSWidth = video.videoWidth;
            videoSHeight = videoSWidth / screenRatio;
            videoSx = 0;
            videoSy = (video.videoHeight - videoSHeight) / 2;
        }
        screenViewCtx.save();
        if (facingMode === 'user') {
            screenViewCtx.scale(-1, 1); // Flip horizontally to match the user's view
            screenViewCtx.translate(-screenWidth, 0);
        }
        screenViewCtx.drawImage(video, videoSx, videoSy, videoSWidth, videoSHeight, 0, 0, screenWidth, screenHeight);
        screenViewCtx.restore();

        // 3. Run segmentation on this accurate view to get a mask
        await mediaPipeService.initialize();
        const fullPersonMask = await mediaPipeService.segmentImage(screenViewCanvas);
        if (!fullPersonMask) {
            throw new Error("Failed to generate segmentation mask for the captured photo. Please ensure you are clearly visible.");
        }

        // 4. Define target aspect ratio and calculate crop dimensions
        const targetWidth = 1080;
        const targetHeight = 1920;
        const targetRatio = targetWidth / targetHeight;
        let cropSWidth, cropSHeight;

        if (screenRatio > targetRatio) { // Screen is wider than 9:16, so height is the constraint
            cropSHeight = screenHeight;
            cropSWidth = cropSHeight * targetRatio;
        } else { // Screen is taller than 9:16, so width is the constraint
            cropSWidth = screenWidth;
            cropSHeight = cropSWidth / targetRatio;
        }
        
        // 5. Calculate the crop's top-left corner (sx, sy) to center on the user
        let cropSx, cropSy;
        const leftShoulder = landmarks?.[11];
        const rightShoulder = landmarks?.[12];

        if (leftShoulder && rightShoulder) {
            // Get user's center in normalized video coordinates
            const userCenterX_video_norm = (leftShoulder.x + rightShoulder.x) / 2;
            const userCenterY_video_norm = (leftShoulder.y + rightShoulder.y) / 2;

            // Convert to video pixel coordinates
            const userCenterX_video_px = userCenterX_video_norm * video.videoWidth;
            const userCenterY_video_px = userCenterY_video_norm * video.videoHeight;
            
            // Calculate where the user's center is on the on-screen canvas (in an unflipped coordinate system)
            const userCenterX_screen_px = ((userCenterX_video_px - videoSx) / videoSWidth) * screenWidth;
            const userCenterY_screen_px = ((userCenterY_video_px - videoSy) / videoSHeight) * screenHeight;

            // The screenViewCanvas is horizontally flipped. The user's center coordinate was calculated
            // for an unflipped view. We must mirror this coordinate to find the center on the flipped canvas.
            const userCenterX_flipped_px = facingMode === 'user' ? screenWidth - userCenterX_screen_px : userCenterX_screen_px;

            // Calculate the top-left corner of the crop box to center it on the user's mirrored position.
            const desiredCropSx = userCenterX_flipped_px - (cropSWidth / 2);
            const desiredCropSy = userCenterY_screen_px - (cropSHeight / 2);
            
            // Clamp the crop box to stay within the screen boundaries
            cropSx = Math.max(0, Math.min(desiredCropSx, screenWidth - cropSWidth));
            cropSy = Math.max(0, Math.min(desiredCropSy, screenHeight - cropSHeight));
            
        } else {
            // Fallback to centering on the screen if landmarks are not available
            console.warn("User landmarks not available for centering. Cropping from screen center.");
            cropSx = (screenWidth - cropSWidth) / 2;
            cropSy = (screenHeight - cropSHeight) / 2;
        }


        // 6. Crop the final assets using the calculated crop box
        const videoFrameCanvas = document.createElement('canvas');
        videoFrameCanvas.width = targetWidth;
        videoFrameCanvas.height = targetHeight;
        videoFrameCanvas.getContext('2d')!.drawImage(screenViewCanvas, cropSx, cropSy, cropSWidth, cropSHeight, 0, 0, targetWidth, targetHeight);
        const videoFrame = videoFrameCanvas.toDataURL('image/png');

        const dpr = window.devicePixelRatio || 1;
        const garmentOverlayCanvas = document.createElement('canvas');
        garmentOverlayCanvas.width = targetWidth;
        garmentOverlayCanvas.height = targetHeight;
        garmentOverlayCanvas.getContext('2d')!.drawImage(
            garmentCanvas, 
            cropSx * dpr, 
            cropSy * dpr, 
            cropSWidth * dpr, 
            cropSHeight * dpr, 
            0, 0, targetWidth, targetHeight
        );
        const garmentOverlay = garmentOverlayCanvas.toDataURL('image/png');

        const mask = fullPersonMask;
        const maskCropSx = Math.floor(cropSx * (mask.width / screenWidth));
        const maskCropSy = Math.floor(cropSy * (mask.height / screenHeight));
        const maskCropSWidth = Math.floor(cropSWidth * (mask.width / screenWidth));
        const maskCropSHeight = Math.floor(cropSHeight * (mask.height / screenHeight));

        const croppedMaskBuffer = new Uint8Array(maskCropSWidth * maskCropSHeight);
        for (let y = 0; y < maskCropSHeight; y++) {
            for (let x = 0; x < maskCropSWidth; x++) {
                const sourceX = maskCropSx + x;
                const sourceY = maskCropSy + y;
                const sourceIndex = sourceY * mask.width + sourceX;
                const destIndex = y * maskCropSWidth + x;
                croppedMaskBuffer[destIndex] = mask.buffer[sourceIndex];
            }
        }
        const personMask: SimpleMask = {
            buffer: croppedMaskBuffer,
            width: maskCropSWidth,
            height: maskCropSHeight,
        };

        // 7. Navigate to the edit page with the new, perfectly aligned assets
        onNavigateToEdit({
            videoFrame,
            garmentOverlay,
            personMask,
            garment: currentGarment,
        });

    } catch(err) {
        console.error("Capture and segmentation failed:", err);
        alert(err instanceof Error ? err.message : "An unknown error occurred during capture.");
    } finally {
        setIsCapturing(false);
    }
  };

  const handleLandmarks = useCallback((newLandmarks: PoseLandmarks) => {
    // Apply an EMA filter to the raw landmark data to reduce jitter.
    const SMOOTHING_FACTOR = 0.5; // 0.0 = max smoothing (lag), 1.0 = no smoothing.
    const smoothed = applyEmaSmoothing(newLandmarks, smoothedLandmarksRef.current, SMOOTHING_FACTOR);
    smoothedLandmarksRef.current = smoothed;
    setLandmarks(smoothed);
  }, []);

  const handleWorldLandmarks = useCallback((newWorldLandmarks: PoseLandmarks) => {
    // Also smooth the world landmarks for more stable 3D orientation.
    const SMOOTHING_FACTOR = 0.5;
    const smoothed = applyEmaSmoothing(newWorldLandmarks, smoothedWorldLandmarksRef.current, SMOOTHING_FACTOR);
    smoothedWorldLandmarksRef.current = smoothed;
    setWorldLandmarks(smoothed);
  }, []);

  const handleSegmentationData = useCallback((data: SegmentationData | null) => {
    setSegmentationData(data);
  }, []);

  const handleSegmentationMask = useCallback((mask: SimpleMask | null) => {
    setSegmentationMask(mask);
  }, []);

  const handleDebugDataUpdate = useCallback((data: { modelHipScreenPosition: {x:number, y:number} | null, hipDistance: number | null }) => {
    setDebugData(data);
  }, []);

  const handleModeChange = useCallback((mode: '2D' | '3D') => {
    setTrackingMode(mode);
  }, []);

  const handleModelLoad = useCallback(() => setIsModelReady(true), []);
  const handleTrackingStatusChange = useCallback((isNowTracking: boolean) => setIsTracking(isNowTracking), []);
  const handleCameraError = useCallback((errorMessage: string) => setError(errorMessage), []);
  
  const handleGarmentSelect = (garment: Garment) => {
      if (garment.id === currentGarment.id) return;
      
      setCurrentGarment(garment);
      if (!loadedGarmentIds.has(garment.id)) {
          setLoadingGarmentId(garment.id);
          // Set isModelReady to false to show the main spinner, as the garment model is the primary content.
          setIsModelReady(false); 
      }
      setIsGarmentPanelOpen(false);
  };

  const handleAccessorySelect = (accessory: Accessory | null) => {
      if (accessory?.id === selectedAccessory?.id && accessory !== null) return;
      
      if(accessory === null) {
          setSelectedAccessory(null);
          return;
      }
      
      if (!loadedAccessoryIds.has(accessory.id)) {
          setLoadingAccessoryId(accessory.id);
      }
      // We set the accessory immediately to trigger the loading effect in GarmentOverlay
      setSelectedAccessory(accessory);
  };
  
  const handleGarmentDownloadComplete = useCallback((id: string) => {
      setLoadedGarmentIds(prev => new Set(prev).add(id));
      setLoadingGarmentId(null);
  }, []);

  const handleAccessoryDownloadComplete = useCallback((id: string) => {
      setLoadedAccessoryIds(prev => new Set(prev).add(id));
      setLoadingAccessoryId(null);
  }, []);


  const isPoseDetected = useMemo(() => !!(landmarks && landmarks.length > 0), [landmarks]);
  const canSwitchCamera = videoDevices.length > 1;

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
        <div className="glassmorphic bg-red-500/20 border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6 max-w-md text-center" role="alert">
          <strong className="font-bold block mb-2 text-white">SYSTEM ERROR</strong>
          <span className="block sm:inline">{error}</span>
        </div>
        <button onClick={onGoHome} className="btn-primary">
            Return to Home Base
        </button>
      </div>
    );
  }
  
  const isExperienceReady = !isRigged || !!userRestPose;
  const showAvatarLoading = isExperienceReady && !isModelReady;
  const avatarModelUrl = currentGarment.yBotUrl || avatar.modelUrl;

  return (
    <main ref={experienceContainerRef} className="relative w-screen h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 w-full h-full">
        <CameraFeed 
            ref={videoRef}
            onLandmarks={handleLandmarks}
            onWorldLandmarks={handleWorldLandmarks} 
            onSegmentationData={handleSegmentationData} 
            onSegmentationMask={handleSegmentationMask}
            onError={handleCameraError} 
            isSegmentationActive={isModelReady && isExperienceReady}
            facingMode={facingMode}
        />
      </div>
      
      {showAvatarLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-50">
            <IconSpinner className="w-16 h-16 animate-spin text-lime-400" />
            <p className="mt-4 text-white font-semibold">Initializing Digital Twin...</p>
        </div>
      )}

      {isModelReady && isExperienceReady && isDevModeVisible && <PoseVisualizer landmarks={landmarks} isFlipped={facingMode === 'user'} modelHipScreenPosition={debugData.modelHipScreenPosition} videoElement={videoRef.current}/>}
      
      {isExperienceReady && (
        <GarmentOverlay
            ref={garmentOverlayRef}
            landmarks={landmarks}
            worldLandmarks={worldLandmarks}
            garment={currentGarment}
            selectedAccessory={selectedAccessory}
            userRestPose={userRestPose}
            defaultIKPose={config.defaultIKPose}
            segmentationData={segmentationData}
            onModelLoad={handleModelLoad}
            onGarmentDownloadComplete={handleGarmentDownloadComplete}
            onAccessoryDownloadComplete={handleAccessoryDownloadComplete}
            onTrackingStatusChange={handleTrackingStatusChange}
            isModelReady={isModelReady}
            isShoulderDetected={isPoseDetected}
            isHipDetected={isPoseDetected}
            onDebugDataUpdate={handleDebugDataUpdate}
            isFlipped={facingMode === 'user'}
            isLegTrackingEnabled={true}
            isDriverVisible={isAvatarDebugVisible}
            videoElement={videoRef.current}
            estimatedLighting={estimatedLighting}
            ikRotationOverrides={ikRotationOverrides}
            upperBodyTarget={upperBodyTarget}
            bendIntensity={bendIntensity}
            hdriUrl={config.brandAssets.hdriUrl}
            avatarUrl={avatarModelUrl}
            isAutoRotating={isAutoRotating}
            onModeChange={handleModeChange}
            isPostProcessingEnabled={isPostProcessingEnabled}
        />
      )}
      
      {showFlash && <div className="absolute inset-0 bg-white z-[100] animate-flash" />}

      {isCapturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-[101]">
              <IconSpinner className="w-16 h-16 animate-spin text-lime-400" />
              <p className="mt-4 text-white font-semibold">Processing Capture...</p>
          </div>
      )}

      {showPoseLoadedToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-lime-500/90 backdrop-blur-sm text-black font-semibold py-3 px-6 rounded-full shadow-lg animate-toast flex items-center space-x-2">
            <IconCheck className="w-5 h-5"/>
            <span>Custom default pose loaded</span>
        </div>
      )}

      {isModelReady && isExperienceReady && (
        <>
            <div className="absolute top-4 left-4 z-50">
            <button onClick={onGoHome} className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
                <IconArrowLeft className="w-6 h-6 text-white" />
            </button>
            </div>
            
            <div className="absolute top-4 right-4 z-50 flex items-start space-x-2">
                <div className="bg-black/50 backdrop-blur-sm p-1 rounded-full shadow-lg text-white">
                    <ToggleSwitch label="" checked={isPostProcessingEnabled} onChange={(e) => setIsPostProcessingEnabled(e.target.checked)} icon={<IconSparkles className="w-5 h-5" />} />
                </div>
                <button onClick={() => setIsGarmentPanelOpen(p => !p)} title="Garments" className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
                    <IconShirt className="w-6 h-6 text-white" />
                </button>
                <button onClick={() => setIsAccessoryPanelOpen(p => !p)} title="Jewelry" className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
                    <IconJewelry className="w-6 h-6 text-white" />
                </button>
                {canSwitchCamera && (
                    <button onClick={handleSwitchCamera} title="Switch Camera" className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
                        <IconSwitchCamera className="w-6 h-6 text-white" />
                    </button>
                )}
                {isDevModeVisible && (
                    <StatusIndicator 
                        isModelReady={isModelReady} 
                        isShoulderDetected={isPoseDetected} 
                        isHipDetected={isPoseDetected}
                        hipDistance={debugData.hipDistance}
                        trackingMode={trackingMode}
                    />
                )}
            </div>

            {isDevModeVisible && (
                <div className="absolute bottom-6 left-4 z-50 flex flex-col items-start space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                    <RotationControl isAutoRotating={isAutoRotating} onToggle={() => setIsAutoRotating(p => !p)} />
                    <TorsoControls
                        rotationOverrides={ikRotationOverrides}
                        onRotationChange={handleRotationChange}
                        onReset={handleResetRotations}
                    />
                    <BodyBendControls 
                        upperBodyTarget={upperBodyTarget}
                        bendIntensity={bendIntensity}
                        onTargetChange={handleTargetChange}
                        onIntensityChange={handleIntensityChange}
                        onReset={handleResetBend}
                    />
                     <div className="glassmorphic p-3 rounded-2xl shadow-lg text-white w-72 space-y-2">
                        <ToggleSwitch label="Show Avatar Body" checked={isAvatarDebugVisible} onChange={(e) => setIsAvatarDebugVisible(e.target.checked)} icon={<IconCube className="w-5 h-5" />} />
                    </div>
                </div>
            )}
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
            <button
                onClick={handleCapturePhoto}
                className="w-20 h-20 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border-2 border-white/50 ring-4 ring-black/30 transform transition-transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Capture Photo"
                disabled={!isTracking || isCapturing}
            >
                 <div className="w-16 h-16 bg-white/90 rounded-full"></div>
            </button>
            </div>
        </>
      )}

      {isGarmentPanelOpen && (
        <GarmentSelector
            garments={config.garments.filter(g => g.isRigged)}
            selectedGarment={currentGarment}
            onSelect={handleGarmentSelect}
            onClose={() => setIsGarmentPanelOpen(false)}
            loadingGarmentId={loadingGarmentId}
            loadedGarmentIds={loadedGarmentIds}
        />
      )}

      {isAccessoryPanelOpen && (
        <AccessorySelector 
            accessories={config.accessories}
            selectedAccessory={selectedAccessory}
            onSelect={handleAccessorySelect}
            onClose={() => setIsAccessoryPanelOpen(false)}
            loadingAccessoryId={loadingAccessoryId}
            loadedAccessoryIds={loadedAccessoryIds}
        />
      )}
      
      <TrackingIndicator isVisible={isTracking} garmentName={currentGarment.name} />
    </main>
  );
};

export default ARExperience;
