import React, { useState, useCallback, useEffect, FC, useRef, useMemo } from 'react';
import { GarmentOverlay } from '../components/GarmentOverlay';
import { PoseLandmarks, Garment, Adjustments, BoneAdjustments, SegmentationData, SimpleMask, UserRestPose, AppConfig, Accessory, Avatar, FirebaseUser } from '../types';
import { DEBUGGABLE_BONES } from '../constants';
import { IconArrowLeft, IconSpinner } from '../components/Icons';
import { StatusIndicator } from '../components/StatusIndicator';
import { AdjustmentControls } from '../components/AdjustmentControls';
import { PoseLandmarker, ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import { StaticPoseVisualizer } from '../components/StaticPoseVisualizer';
import { calculateBoundingBoxFromMask } from '../components/segmentation';
import { SegmentationOverlay } from '../components/SegmentationOverlay';
import { calculateUserRestPose } from '../components/poseRetargeting';

interface StaticImageExperienceProps {
  garment: Garment;
  imageUrl: string;
  avatar: Avatar;
  onGoHome: () => void;
  config: AppConfig;
  currentUser: FirebaseUser | null;
  onRequestLogin: () => void;
}

const initialAdjustments: Adjustments = { scale: 1, rotation: { x: 0, y: 0, z: 0 }, xOffset: 0, yOffset: 0, hipHeightOffset: 0 };

const createInitialBoneAdjustments = (): BoneAdjustments => {
    const adjustments: BoneAdjustments = {};
    DEBUGGABLE_BONES.forEach(boneName => {
        adjustments[boneName] = {
            rotation: { x: 0, y: 0, z: 0 },
            isInverted: false,
        };
    });
    return adjustments;
};

const StaticImageExperience: FC<StaticImageExperienceProps> = ({ garment, imageUrl, avatar, onGoHome, config, currentUser, onRequestLogin }) => {
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [worldLandmarks, setWorldLandmarks] = useState<PoseLandmarks | null>(null);
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null);
  const [segmentationMask, setSegmentationMask] = useState<SimpleMask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});
  const [userRestPose, setUserRestPose] = useState<UserRestPose | null>(null);

  const [adjustments, setAdjustments] = useState<Adjustments>(initialAdjustments);
  const [boneAdjustments, setBoneAdjustments] = useState<BoneAdjustments>(createInitialBoneAdjustments());

  const [isModelReady, setIsModelReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isDriverVisible, setDriverVisible] = useState(false);
  const [isSegmentationVisible, setSegmentationVisible] = useState(false);
  const [debugData, setDebugData] = useState<{ modelHipScreenPosition: {x:number, y:number} | null; hipDistance: number | null; }>({ modelHipScreenPosition: null, hipDistance: null });
  const [isPostProcessingEnabled, setIsPostProcessingEnabled] = useState(true);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const imageSegmenterRef = useRef<ImageSegmenter | null>(null);
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);


  const isRigged = useMemo(() => garment.isRigged || false, [garment]);

  useEffect(() => {
    // After the image has loaded and been processed, if the user is not logged in,
    // wait 3 seconds and then prompt them to sign in.
    if (!isLoading && !error && !currentUser) {
        const timer = setTimeout(() => {
            // Check again in case the user logged in during the 3-second delay
            if (!currentUserRef.current) {
                onRequestLogin();
            }
        }, 3000);

        return () => clearTimeout(timer);
    }
  }, [isLoading, error, currentUser, onRequestLogin]);

  useEffect(() => {
    let isMounted = true;
    const createMediaPipeTasks = async () => {
      try {
        setLoadingMessage('Loading AI Models...');
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm");
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numPoses: 1,
        });
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
                delegate: 'GPU',
            },
            runningMode: 'IMAGE',
            outputConfidenceMasks: true,
        });

        if (isMounted) {
            poseLandmarkerRef.current = landmarker;
            imageSegmenterRef.current = segmenter;
            // The image might already be loaded by the time this runs.
            if(imageRef.current?.complete) {
              processImage(imageRef.current);
            }
        }
      } catch (e) {
        console.error("Failed to create MediaPipe tasks", e);
        if(isMounted) setError("Failed to load AI models for analysis.");
      }
    };
    createMediaPipeTasks();
    return () => { 
        isMounted = false; 
        poseLandmarkerRef.current?.close(); 
        imageSegmenterRef.current?.close();
    };
  }, []);

  const processImage = useCallback((imageElement: HTMLImageElement) => {
    if (!poseLandmarkerRef.current || !imageSegmenterRef.current) {
        setLoadingMessage('Waiting for AI models to initialize...');
        return;
    }
    
    setLoadingMessage('Analyzing pose & segmentation...');
    
    const poseResults = poseLandmarkerRef.current.detect(imageElement);
    const segmentationResult = imageSegmenterRef.current.segment(imageElement);
    
    if (poseResults.landmarks && poseResults.landmarks.length > 0) {
      const landmarksCopy = poseResults.landmarks[0].map(lm => ({ ...lm }));
      setLandmarks(landmarksCopy);

      if (poseResults.worldLandmarks && poseResults.worldLandmarks.length > 0) {
        const worldLandmarksCopy = poseResults.worldLandmarks[0].map(lm => ({ ...lm }));
        setWorldLandmarks(worldLandmarksCopy);
      }

      if (isRigged) {
        setUserRestPose(calculateUserRestPose(landmarksCopy));
      }
    } else {
      setError("Could not detect a pose in the uploaded image. Please try another one with a clear, full-body view.");
    }
    
    if (segmentationResult && segmentationResult.confidenceMasks && segmentationResult.confidenceMasks.length > 0) {
        const mask = segmentationResult.confidenceMasks[0]; // MPMask with float data
        
        const float32Array = mask.getAsFloat32Array();
        const uint8Array = new Uint8Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            uint8Array[i] = Math.round(float32Array[i] * 255);
        }
        
        const maskCopy: SimpleMask = {
            buffer: uint8Array,
            width: mask.width,
            height: mask.height,
        };
        setSegmentationMask(maskCopy);
        const bbox = calculateBoundingBoxFromMask(maskCopy); // passing SimpleMask
        if (bbox) {
          setSegmentationData(bbox);
        }
    }

    setIsLoading(false);
  }, [isRigged]);

  // This effect calculates the correct position and size of the overlays to match the `object-contain` image.
  useEffect(() => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) return;

    const calculateStyles = () => {
      const { naturalWidth: iWidth, naturalHeight: iHeight } = image;
      const { clientWidth: vWidth, clientHeight: vHeight } = container;

      if (iWidth === 0 || iHeight === 0) return;

      const iRatio = iWidth / iHeight;
      const vRatio = vWidth / vHeight;
      
      let renderedWidth, renderedHeight, top, left;

      if (vRatio > iRatio) {
        renderedHeight = vHeight;
        renderedWidth = vHeight * iRatio;
        left = (vWidth - renderedWidth) / 2;
        top = 0;
      } else {
        renderedWidth = vWidth;
        renderedHeight = vWidth / iRatio;
        top = (vHeight - renderedHeight) / 2;
        left = 0;
      }

      setOverlayStyle({
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${renderedWidth}px`,
        height: `${renderedHeight}px`,
      });
    };

    const handleImageLoad = () => {
        calculateStyles();
        if (poseLandmarkerRef.current && imageSegmenterRef.current) {
            processImage(image);
        }
    };

    if (image.complete) {
        handleImageLoad();
    } else {
        image.addEventListener('load', handleImageLoad);
    }
    
    window.addEventListener('resize', calculateStyles);

    return () => {
        image.removeEventListener('load', handleImageLoad);
        window.removeEventListener('resize', calculateStyles);
    };
  }, [imageUrl, processImage]);

  const handleDebugDataUpdate = useCallback((data: { modelHipScreenPosition: {x:number, y:number} | null; hipDistance: number | null; }) => {
    setDebugData(data);
  }, []);

  const handleAdjustmentChange = (field: string, value: number) => {
    setAdjustments(prev => {
      const keys = field.split('.');
      if (keys.length === 2) {
        return { ...prev, [keys[0]]: { ...(prev as any)[keys[0]], [keys[1]]: value } };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleResetAdjustments = () => setAdjustments(initialAdjustments);

  const handleModelLoad = useCallback(() => setIsModelReady(true), []);
  const handleTrackingStatusChange = useCallback((isNowTracking: boolean) => setIsTracking(isNowTracking), []);

  const isPoseDetected = useMemo(() => !!(landmarks && landmarks.length > 0), [landmarks]);
  const avatarModelUrl = garment.yBotUrl || avatar.modelUrl;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-900 flex items-center justify-center">
      {isLoading && (
        <div className="absolute z-50 flex flex-col items-center justify-center bg-black/80 p-8 rounded-lg">
          <IconSpinner className="w-16 h-16 animate-spin text-amber-400" />
          <p className="mt-4 text-white">{loadingMessage}</p>
        </div>
      )}

      {error && (
        <div className="absolute z-50 flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6 max-w-md text-center" role="alert">
            <strong className="font-bold block mb-2 text-white">Analysis Failed</strong>
            <span className="block sm:inline">{error}</span>
          </div>
          <button onClick={onGoHome} className="bg-[#D4AF37] text-black font-bold py-2 px-6 rounded-lg hover:bg-[#c8a432] transition-colors">Go Home</button>
        </div>
      )}

      <div ref={containerRef} className="relative w-full h-full">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="User uploaded photo for try-on"
          className="w-full h-full object-contain z-0"
          crossOrigin="anonymous" // Important for canvas analysis
        />
        
        {!isLoading && !error && (
          <>
            <StaticPoseVisualizer landmarks={landmarks} overlayStyle={overlayStyle} modelHipScreenPosition={debugData.modelHipScreenPosition} />
            {isSegmentationVisible && <SegmentationOverlay mask={segmentationMask} overlayStyle={overlayStyle} isFlipped={false} />}
            <GarmentOverlay
              landmarks={landmarks}
              worldLandmarks={worldLandmarks}
              garment={garment}
              selectedAccessory={null}
              adjustments={adjustments}
              boneAdjustments={boneAdjustments}
              userRestPose={userRestPose}
              isLegTrackingEnabled={true}
              isDriverVisible={isDriverVisible}
              segmentationData={segmentationData}
              onModelLoad={handleModelLoad}
              onGarmentDownloadComplete={() => {}}
              onAccessoryDownloadComplete={() => {}}
              onTrackingStatusChange={handleTrackingStatusChange}
              isModelReady={isModelReady}
              isShoulderDetected={isPoseDetected}
              isHipDetected={isPoseDetected}
              containerStyle={overlayStyle}
              onDebugDataUpdate={handleDebugDataUpdate}
              isFlipped={false}
              hdriUrl={config.brandAssets.hdriUrl}
              avatarUrl={avatarModelUrl}
              isPostProcessingEnabled={isPostProcessingEnabled}
            />
          </>
        )}
      </div>

      <div className="absolute top-4 left-4 z-50">
        <button onClick={onGoHome} className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors">
          <IconArrowLeft className="w-6 h-6 text-white" />
        </button>
      </div>
      
      {!isLoading && !error && (
        <>
            <div className="absolute top-4 right-4 z-50">
                <StatusIndicator 
                  isModelReady={isModelReady} 
                  isShoulderDetected={isPoseDetected} 
                  isHipDetected={isPoseDetected}
                  hipDistance={debugData.hipDistance}
                />
            </div>

            <div className="absolute bottom-4 left-4 z-50 flex flex-col items-start space-y-4">
                <AdjustmentControls
                adjustments={adjustments}
                onAdjustmentChange={handleAdjustmentChange}
                onReset={handleResetAdjustments}
                isRigged={isRigged}
                isDriverVisible={isDriverVisible}
                onToggleDriverVisibility={() => setDriverVisible(!isDriverVisible)}
                isSegmentationVisible={isSegmentationVisible}
                onToggleSegmentationVisibility={() => setSegmentationVisible(!isSegmentationVisible)}
                isPostProcessingEnabled={isPostProcessingEnabled}
                onTogglePostProcessing={() => setIsPostProcessingEnabled(p => !p)}
                />
            </div>
        </>
      )}
    </main>
  );
};

export default StaticImageExperience;