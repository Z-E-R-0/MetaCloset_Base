import React, { useState, useCallback, FC, useRef, useEffect } from 'react';
import { PoseLandmarks, UserRestPose, AppConfig } from '../types';
import { IconArrowLeft, IconSpinner, IconPhoto } from '../components/Icons';
import { calculateUserRestPose } from '../components/poseRetargeting';
import { MultiAvatarScene } from '../components/MultiAvatarScene';
import { DanceArenaControls, FormationType } from '../components/DanceArenaControls';
import { PoseSkeletonCanvas } from '../components/PoseSkeletonCanvas';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface DanceArenaProps {
  onGoHome: () => void;
  config: AppConfig;
}

const DanceArena: FC<DanceArenaProps> = ({ onGoHome, config }) => {
    const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
    const [worldLandmarks, setWorldLandmarks] = useState<PoseLandmarks | null>(null);
    const [userRestPose, setUserRestPose] = useState<UserRestPose | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [numAvatars, setNumAvatars] = useState(5);
    const [formation, setFormation] = useState<FormationType>('v-shape');
    const [avatarSpacing, setAvatarSpacing] = useState(2.5);

    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showSkeletonDebug, setShowSkeletonDebug] = useState(true);
    const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 360 });
    const [isVerticalVideo, setIsVerticalVideo] = useState(false);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastVideoTimeRef = useRef(-1);
    const animationFrameId = useRef<number | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  
    // Initialize MediaPipe
    useEffect(() => {
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm");
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numPoses: 1,
                });
                poseLandmarkerRef.current = landmarker;
            } catch (e) {
                console.error("Failed to init MediaPipe", e);
                setError("Failed to initialize AI models for pose tracking.");
            }
        };
        initMediaPipe();

        return () => {
            poseLandmarkerRef.current?.close();
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if (videoSrc) {
                URL.revokeObjectURL(videoSrc);
            }
        };
    }, []);

    const processVideo = useCallback(() => {
        const video = videoRef.current;
        const poseLandmarker = poseLandmarkerRef.current;

        if (!video || video.paused || video.ended || !poseLandmarker) {
            animationFrameId.current = requestAnimationFrame(processVideo);
            return;
        }

        const now = performance.now();
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            
            poseLandmarker.detectForVideo(video, now, (result) => {
                if (video.videoWidth && video.videoHeight) {
                    setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
                    setIsVerticalVideo(video.videoHeight > video.videoWidth);
                }
                if (result.landmarks && result.landmarks.length > 0) {
                    setLandmarks(result.landmarks[0].map(lm => ({ ...lm })));
                    if (result.worldLandmarks && result.worldLandmarks.length > 0) {
                        setWorldLandmarks(result.worldLandmarks[0].map(lm => ({ ...lm })));
                    } else {
                        setWorldLandmarks(null);
                    }
                } else {
                    setLandmarks(null);
                    setWorldLandmarks(null);
                }
            });
        }
        animationFrameId.current = requestAnimationFrame(processVideo);
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (videoSrc) {
                URL.revokeObjectURL(videoSrc);
            }
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setUserRestPose(null);
            setLandmarks(null);
            setWorldLandmarks(null);
            setIsLoading(true);
            setLoadingMessage('Calibrating from video...');
        }
    };

    const handleVideoLoaded = () => {
        const video = videoRef.current;
        if (!video) return;

        const onSeeked = async () => {
            const poseLandmarker = poseLandmarkerRef.current;
            if (!video || !poseLandmarker) return;

            video.pause(); // Ensure it's paused for detection

            // Temporarily switch to IMAGE mode for single frame detection
            await poseLandmarker.setOptions({ runningMode: 'IMAGE' });
            const result = poseLandmarker.detect(video);
            // Switch back to VIDEO mode for continuous tracking
            await poseLandmarker.setOptions({ runningMode: 'VIDEO' });
            
            if (result.landmarks && result.landmarks.length > 0) {
                const restPose = calculateUserRestPose(result.landmarks[0]);
                setUserRestPose(restPose);
                setIsLoading(false);
                setLoadingMessage('');
                video.play(); // Start playback now that calibration is done
                processVideo(); // Start the detection loop
            } else {
                setError("Could not detect a pose in the first frame of the video. Please use a video where the dancer is in a T-pose at the start.");
                setIsLoading(false);
            }
        };

        // Add a one-time event listener for 'seeked'
        video.addEventListener('seeked', onSeeked, { once: true });
        
        // This will trigger the 'seeked' event once the frame is ready
        video.currentTime = 0.01; // Seek to a very early frame to ensure it's loaded
    };

    if (error) {
        return (
            <div className="w-screen h-screen flex flex-col items-center justify-center bg-zinc-900 text-white p-4">
                <div className="glassmorphic bg-red-500/20 border-red-500 text-red-200 px-4 py-3 rounded-lg relative mb-6 max-w-md text-center" role="alert">
                    <strong className="font-bold block mb-2 text-white">SYSTEM ERROR</strong>
                    <span className="block sm:inline">{error}</span>
                </div>
                <button onClick={onGoHome} className="btn-primary">Return to Home Base</button>
            </div>
        );
    }
  
    return (
        <main className="relative w-screen h-screen overflow-hidden bg-black flex flex-col lg:flex-row">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={onGoHome} className="bg-black/50 backdrop-blur-md p-3 rounded-full shadow-lg hover:bg-zinc-800 transition-colors" aria-label="Back to home">
                    <IconArrowLeft className="w-6 h-6 text-white" />
                </button>
            </div>

            {/* Left Panel: Controls & Video */}
            <div className="w-full lg:w-1/3 h-1/2 lg:h-full min-h-0 flex flex-col p-4 space-y-4 z-10 bg-zinc-900/50 backdrop-blur-sm border-r border-zinc-700/50">
                <h1 className="text-3xl font-bold text-white pt-12 text-center lg:text-left">Dance Arena</h1>
                <DanceArenaControls
                    numAvatars={numAvatars}
                    setNumAvatars={setNumAvatars}
                    formation={formation}
                    setFormation={setFormation}
                    spacing={avatarSpacing}
                    setSpacing={setAvatarSpacing}
                />

                <div className="flex-grow flex flex-col bg-zinc-800/50 p-4 rounded-lg">
                    <h2 className="text-lg font-semibold text-white mb-2">Dance Video</h2>
                    <div
                        className={`w-full bg-black rounded-md overflow-hidden relative ${
                            isVerticalVideo ? 'aspect-[9/16]' : 'aspect-video'
                        }`}
                    >
                        {videoSrc ? (
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                controls
                                loop
                                muted
                                playsInline
                                onLoadedData={handleVideoLoaded}
                                onLoadedMetadata={() => {
                                    const v = videoRef.current;
                                    if (v?.videoWidth && v?.videoHeight) {
                                        setVideoDimensions({ width: v.videoWidth, height: v.videoHeight });
                                        setIsVerticalVideo(v.videoHeight > v.videoWidth);
                                    }
                                }}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 min-h-[120px]">
                                <IconPhoto className="w-12 h-12 mb-2" />
                                <span>No video selected</span>
                            </div>
                        )}
                        {isLoading && (
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                                <IconSpinner className="w-8 h-8 animate-spin text-lime-400" />
                                <p className="mt-2 text-sm">{loadingMessage}</p>
                            </div>
                        )}
                        <PoseSkeletonCanvas
                            landmarks={landmarks}
                            videoWidth={videoDimensions.width}
                            videoHeight={videoDimensions.height}
                            visible={showSkeletonDebug && !!videoSrc && !isLoading}
                        />
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-sm text-zinc-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showSkeletonDebug}
                            onChange={(e) => setShowSkeletonDebug(e.target.checked)}
                            className="rounded border-zinc-600 bg-zinc-800 text-lime-400 focus:ring-lime-400"
                        />
                        <span>Show skeleton overlay</span>
                    </label>
                    <input type="file" ref={fileInputRef} accept="video/*" onChange={handleFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="btn-primary w-full mt-4">
                        Upload Video
                    </button>
                    <p className="text-xs text-zinc-500 mt-2 text-center">For best results, start video with the dancer in a T-pose.</p>
                </div>
            </div>

            {/* Right Panel: 3D Scene */}
            <div className="w-full lg:w-2/3 h-1/2 lg:h-full min-h-0 relative flex-1">
                <MultiAvatarScene
                    landmarks={landmarks}
                    worldLandmarks={worldLandmarks}
                    userRestPose={userRestPose}
                    onModelLoad={() => {}}
                    isFlipped={false}
                    videoElement={videoRef.current}
                    hdriUrl={config.brandAssets.hdriUrl}
                    avatarUrl={config.brandAssets.yBotUrl}
                    numAvatars={numAvatars}
                    formation={formation}
                    spacing={avatarSpacing}
                />
            </div>
        </main>
    );
};

export default DanceArena;