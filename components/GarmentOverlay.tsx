import React, { useEffect, useRef, FC, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PoseLandmarks, Garment, Landmark, SegmentationData, UserRestPose, Adjustments, BoneAdjustments, ManualIKState, IKRotationOverrides, Accessory } from '../types';
import { remapLandmark } from './poseRetargeting';
import { useThreeCore } from './useThreeCore';
import { useAvatar } from './useAvatar';
import { getBone } from './threeUtils';
import { useAvatarTracking } from './useAvatarTracking';

// A global adjustment factor for the base size of the Y-Bot avatar model.
// A value < 1 makes the model smaller, > 1 makes it larger.
const AVATAR_BASE_SCALE = 1;

// An adjustment factor for the torso/body width.
// A value < 1 makes the model slimmer on the X/Z axes.
const AVATAR_BODY_WIDTH_SCALE = 0.90;

interface GarmentOverlayProps {
  landmarks: PoseLandmarks | null;
  worldLandmarks: PoseLandmarks | null;
  garment: Garment;
  selectedAccessory: Accessory | null;
  userRestPose: UserRestPose | null;
  segmentationData: SegmentationData | null;
  onModelLoad: () => void;
  onGarmentDownloadComplete?: (id: string) => void;
  onAccessoryDownloadComplete?: (id: string) => void;
  onTrackingStatusChange: (isTracking: boolean) => void;
  isModelReady: boolean;
  isShoulderDetected: boolean;
  isHipDetected: boolean;
  containerStyle?: React.CSSProperties;
  isFlipped: boolean;
  onDebugDataUpdate?: (data: { modelHipScreenPosition: { x: number; y: number } | null; hipDistance: number | null }) => void;
  debugTrigger?: number;
  videoElement?: HTMLVideoElement | null;
  defaultIKPose?: ManualIKState;
  estimatedLighting?: { 
    key: { r: number, g: number, b: number, intensity: number, x: number }, 
    fill: { r: number, g: number, b: number, intensity: number, x: number }, 
    ambient: { r: number, g: number, b: number, intensity: number },
    hdriIntensity: number,
  };
  hdriUrl?: string;
  avatarUrl?: string;

  adjustments?: Adjustments;
  boneAdjustments?: BoneAdjustments;
  isDriverVisible?: boolean;
  isLegTrackingEnabled?: boolean;
  ikRotationOverrides?: IKRotationOverrides;
  isAutoRotating?: boolean;
  upperBodyTarget?: { x: number; y: number; z: number };
  bendIntensity?: number;
  onModeChange?: (mode: '2D' | '3D') => void;
  isPostProcessingEnabled?: boolean;
}

export interface GarmentOverlayHandles {
  getCanvas: () => HTMLCanvasElement | null;
}

const landmarkIndex = { nose:0, lSh:11, rSh:12, lEl:13, rEl:14, lWr:15, rWr:16, lEar: 7, rEar: 8, lHp:23, rHp:24, lKn:25, rKn:26, lAn:27, rAn:28, lToe: 31, rToe: 32 };
const LR = <T,>(flip:boolean, left:T, right:T)=> (flip ? right : left);
const TRANSFORM_POINT_NAMES = ['leftShoulder', 'rightShoulder', 'leftHip', 'rightHip'];
const JOINT_WEIGHTS: { [key: string]: number } = {
  leftHip: 3, rightHip: 3, leftShoulder: 2, rightShoulder: 2,
  leftKnee: 1, rightKnee: 1, leftElbow: 1, rightElbow: 1,
  leftAnkle: 0.5, rightAnkle: 0.5, leftWrist: 0.5, rightWrist: 0.5,
};

// --- compute yaw from world shoulders for 360° rotation coherence ---
// NOTE: MediaPipe's "world landmarks" are relative to the user's hip center, not a true world origin.
// For camera-relative rotation, Umeyama on 2D landmarks is more reliable.
function yawFromWorldShoulders(wL: Landmark, wR: Landmark) {
  // MediaPipe Body-Local Coordinates: +X Left, +Y Up, +Z Front
  const shoulderVecX = wL.x - wR.x;
  const shoulderVecZ = wL.z - wR.z;
  
  // atan2(z, x) gives the angle for a top-down view.
  return Math.atan2(shoulderVecZ, shoulderVecX);
}

export const GarmentOverlay = forwardRef<GarmentOverlayHandles, GarmentOverlayProps>(({ 
  landmarks, worldLandmarks, garment, selectedAccessory,
  segmentationData, onModelLoad, onGarmentDownloadComplete, onAccessoryDownloadComplete,
  onTrackingStatusChange, isModelReady,
  isShoulderDetected, isHipDetected,
  containerStyle, isFlipped, onDebugDataUpdate, userRestPose,
  defaultIKPose,
  estimatedLighting,
  hdriUrl,
  avatarUrl,
  adjustments, isDriverVisible, isLegTrackingEnabled, videoElement,
  ikRotationOverrides, isAutoRotating, upperBodyTarget, bendIntensity,
  onModeChange, isPostProcessingEnabled,
}, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const threeCore = useThreeCore({ mountRef, hdriUrl });
    const { 
        driverModel, yBotMeshes, isAvatarLoaded,
        rigRestPoints, 
        hipAnchorLocal, initialSpineRotations, initialBoneData,
        modelTorsoHeight,
    } = useAvatar(threeCore?.scene || null, defaultIKPose, avatarUrl);

    // Since useAvatar no longer adds the model to the scene, this component must do so.
    useEffect(() => {
        const scene = threeCore?.scene;
        if (scene && driverModel) {
            scene.add(driverModel);
            return () => {
                // Ensure the model is still a child before removing to prevent errors on re-renders
                if (driverModel.parent === scene) {
                    scene.remove(driverModel);
                }
            };
        }
    }, [threeCore, driverModel]);

    const garmentRef = useRef<THREE.Object3D | null>(null);
    const [isGarmentModelLoaded, setGarmentModelLoaded] = useState(false);
    
    const accessoryGroupRef = useRef<THREE.Group | null>(null);

    const lastTrackingStatusRef = useRef<boolean | null>(null);
    const mtpEMARef = useRef<number | null>(null);
    const hipSwayEmaRef = useRef<number | null>(null);
    const lastReportedModeRef = useRef<'2D' | '3D' | null>(null);

    // NEW: smoothed hip/anchor to stabilize target placement
    const hipCenterEmaRef = useRef<THREE.Vector3 | null>(null);

    useImperativeHandle(ref, () => ({ getCanvas: () => threeCore?.renderer?.domElement || null }));
    
    const landmarksRef = useRef(landmarks); useEffect(()=>{ landmarksRef.current=landmarks; },[landmarks]);
    const worldLandmarksRef = useRef(worldLandmarks); useEffect(()=>{ worldLandmarksRef.current=worldLandmarks; },[worldLandmarks]);
    const garmentPropRef = useRef(garment); useEffect(()=>{ garmentPropRef.current=garment; },[garment]);
    const userRestPoseRef = useRef(userRestPose); 
    useEffect(()=>{ 
        userRestPoseRef.current=userRestPose;
        hipSwayEmaRef.current = null; // Reset hip sway smoother on new calibration
    },[userRestPose]);

    const segmentationDataRef = useRef(segmentationData); useEffect(()=>{ segmentationDataRef.current=segmentationData; },[segmentationData]);
    const isModelReadyRef = useRef(isModelReady); useEffect(()=>{ isModelReadyRef.current=isModelReady; },[isModelReady]);
    const isFlippedRef = useRef(isFlipped); useEffect(()=>{ isFlippedRef.current=isFlipped; },[isFlipped]);
    const onDebugDataUpdateRef = useRef(onDebugDataUpdate); useEffect(()=>{ onDebugDataUpdateRef.current=onDebugDataUpdate; },[onDebugDataUpdate]);
    const isShoulderDetectedRef = useRef(isShoulderDetected); useEffect(()=>{ isShoulderDetectedRef.current=isShoulderDetected; },[isShoulderDetected]);
    const isHipDetectedRef = useRef(isHipDetected); useEffect(()=>{ isHipDetectedRef.current=isHipDetected; },[isHipDetected]);
    const adjustmentsRef = useRef(adjustments); useEffect(()=>{ adjustmentsRef.current = adjustments; }, [adjustments]);
    const estimatedLightingRef = useRef(estimatedLighting); useEffect(()=>{ estimatedLightingRef.current = estimatedLighting; }, [estimatedLighting]);
    const isDriverVisibleRef = useRef(isDriverVisible); useEffect(()=>{ isDriverVisibleRef.current = isDriverVisible; }, [isDriverVisible]);
    const isLegTrackingEnabledRef = useRef(isLegTrackingEnabled); useEffect(()=>{ isLegTrackingEnabledRef.current = isLegTrackingEnabled; }, [isLegTrackingEnabled]);
    const videoElementRef = useRef(videoElement); useEffect(() => { videoElementRef.current = videoElement; }, [videoElement]);
    const ikRotationOverridesRef = useRef(ikRotationOverrides); useEffect(() => { ikRotationOverridesRef.current = ikRotationOverrides; }, [ikRotationOverrides]);
    const isAutoRotatingRef = useRef(isAutoRotating); useEffect(()=>{ isAutoRotatingRef.current = isAutoRotating; }, [isAutoRotating]);
    const upperBodyTargetRef = useRef(upperBodyTarget); useEffect(()=>{ upperBodyTargetRef.current = upperBodyTarget; }, [upperBodyTarget]);
    const bendIntensityRef = useRef(bendIntensity); useEffect(()=>{ bendIntensityRef.current = bendIntensity; }, [bendIntensity]);
    const onModeChangeRef = useRef(onModeChange); useEffect(() => { onModeChangeRef.current = onModeChange; }, [onModeChange]);
    const selectedAccessoryRef = useRef(selectedAccessory); useEffect(()=>{ selectedAccessoryRef.current = selectedAccessory; }, [selectedAccessory]);
    const isPostProcessingEnabledRef = useRef(isPostProcessingEnabled); useEffect(()=>{ isPostProcessingEnabledRef.current = isPostProcessingEnabled; },[isPostProcessingEnabled]);


    useEffect(() => {
        const ready = garment.isRigged ? (isAvatarLoaded && isGarmentModelLoaded) : isGarmentModelLoaded;
        if (ready) onModelLoad();
    }, [isAvatarLoaded, isGarmentModelLoaded, garment.isRigged, onModelLoad]);
    
    useEffect(() => {
        if (!threeCore || !driverModel || !garment.isRigged) return;

        setGarmentModelLoaded(false);
        if (garmentRef.current) { driverModel.remove(garmentRef.current); garmentRef.current = null; }
        
        lastTrackingStatusRef.current = null;
        onTrackingStatusChange(false);
        
        const loader = new GLTFLoader();
        loader.load(garment.modelUrl, (gltf) => {
            onGarmentDownloadComplete?.(garment.id);
            const model = gltf.scene;
            model.position.set(0, 0, 0);
            model.quaternion.set(0, 0, 0, 1);
            model.scale.set(1, 1, 1);
            model.updateMatrixWorld(true);

            model.traverse(c => {
                if (c instanceof THREE.Mesh) {
                    c.renderOrder = 2; // Render garments after the avatar body
                    const materials = Array.isArray(c.material) ? c.material : [c.material];
                    materials.forEach(mat => {
                        if (mat) {
                            mat.polygonOffset = true;
                            mat.polygonOffsetFactor = -1.0; // Push geometry forward
                            mat.polygonOffsetUnits = -1.0;
                        }
                    });
                }
            });
            
            let driverSkinnedMesh: THREE.SkinnedMesh | null = null;
            driverModel.traverse(n => { if (n instanceof THREE.SkinnedMesh && !driverSkinnedMesh) driverSkinnedMesh = n; });
            if (driverSkinnedMesh) {
                const normalize = (name:string)=> name.replace(/^(mixamorig:|mixamorig)/,'');
                const driverMap = new Map<string, THREE.Bone>();
                driverSkinnedMesh.skeleton.bones.forEach(b=> driverMap.set(normalize(b.name), b));
                model.traverse(ch=>{
                    if (ch instanceof THREE.SkinnedMesh) {
                        // FIX: Reset the local transform of the SkinnedMesh itself to prevent any offsets baked into the GLB.
                        ch.position.set(0, 0, 0);
                        ch.quaternion.set(0, 0, 0, 1);
                        ch.scale.set(1, 1, 1);
                        ch.updateMatrixWorld(true);

                        const newBones: THREE.Bone[] = [];
                        ch.skeleton.bones.forEach(gb=>{
                            const db = driverMap.get(normalize(gb.name));
                            newBones.push(db || gb);
                        });
                        const newSkel = new THREE.Skeleton(newBones);
                        ch.bind(newSkel, driverSkinnedMesh!.bindMatrix);
                    }
                });
            }
            driverModel.add(model);
            garmentRef.current = model;
            setGarmentModelLoaded(true);
        }, undefined, (err)=>{ console.error('Model load error:', err); setGarmentModelLoaded(true); onGarmentDownloadComplete?.(garment.id); });

        return () => {
             if (garmentRef.current) {
                driverModel.remove(garmentRef.current);
                garmentRef.current = null;
            }
        }
    }, [garment.modelUrl, garment.id, garment.isRigged, driverModel, onTrackingStatusChange, threeCore, onGarmentDownloadComplete]);

    // Effect for loading/unloading accessories
    useEffect(() => {
        if (!driverModel || !threeCore) return;

        const cleanup = () => {
            if (accessoryGroupRef.current && accessoryGroupRef.current.parent) {
                accessoryGroupRef.current.parent.remove(accessoryGroupRef.current);
                accessoryGroupRef.current = null;
            }
        };

        cleanup(); // Clean up previous accessory first

        if (selectedAccessory) {
            const parentBone = getBone(driverModel, selectedAccessory.attachmentBone);
            if (!parentBone) {
                console.error(`Attachment bone "${selectedAccessory.attachmentBone}" not found for accessory "${selectedAccessory.name}".`);
                return;
            }

            const loader = new GLTFLoader();
            loader.load(selectedAccessory.modelUrl, (gltf) => {
                onAccessoryDownloadComplete?.(selectedAccessory.id);
                
                const accessoryGroup = new THREE.Group();
                accessoryGroupRef.current = accessoryGroup;
                const model1 = gltf.scene;

                const normalizeAccessory = (obj: THREE.Object3D) => {
                  obj.traverse((n: any) => {
                    if (n.isMesh) {
                      n.frustumCulled = false;
                      if (n.material && 'depthWrite' in n.material) n.material.depthWrite = true;
                      n.renderOrder = 3; // Render accessories on top of garments
                      const materials = Array.isArray(n.material) ? n.material : [n.material];
                      materials.forEach(mat => {
                        if (mat) {
                            mat.polygonOffset = true;
                            mat.polygonOffsetFactor = -2.0; // More aggressive offset to ensure it's on top of garment
                            mat.polygonOffsetUnits = -1.0;
                        }
                      });
                    }
                  });
                  // reset authoring transforms so our runtime placement is in control
                  obj.position.set(0, 0, 0);
                  obj.quaternion.set(0, 0, 0, 1);
                  obj.scale.set(1, 1, 1);
                  obj.updateMatrixWorld(true);
                };

                model1.traverse(node => {
                    if (node instanceof THREE.Mesh && node.material) {
                        (node.material as THREE.Material).side = THREE.DoubleSide;
                    }
                });
                normalizeAccessory(model1);
                accessoryGroup.add(model1);

                if (selectedAccessory.isPair) {
                    const model2 = model1.clone(true);
                     model2.traverse(node => {
                        if (node instanceof THREE.Mesh && node.material) {
                            (node.material as THREE.Material).side = THREE.DoubleSide;
                        }
                    });
                    normalizeAccessory(model2);
                    accessoryGroup.add(model2);
                }
                
                parentBone.add(accessoryGroup);

            }, undefined, (error) => {
                console.error(`Failed to load accessory: ${selectedAccessory.name}`, error);
                onAccessoryDownloadComplete?.(selectedAccessory.id);
            });
        }
        
        return cleanup;
    }, [selectedAccessory, driverModel, threeCore, onAccessoryDownloadComplete]);
    
    useEffect(() => {
        const scene = threeCore?.scene;
        if (!scene || garment.isRigged) return;
        
        setGarmentModelLoaded(false);
        if (garmentRef.current) { scene.remove(garmentRef.current); garmentRef.current = null; }
        
        const loader = new GLTFLoader();
        loader.load(garment.modelUrl, (gltf) => {
            onGarmentDownloadComplete?.(garment.id);
            const model = gltf.scene;
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) ([child.material] as any[]).flat().forEach((m:THREE.Material)=> m.side = THREE.DoubleSide);
            });
            const container = new THREE.Group(); container.add(model);
            const box = new THREE.Box3().setFromObject(container);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            container.userData.normalizationScale = size.x > 0 ? 1/size.x : 1;
            container.rotation.y = Math.PI;
            garmentRef.current = container;
            scene.add(container);
            setGarmentModelLoaded(true);
        }, undefined, (err)=>{ console.error('Model load error:', err); setGarmentModelLoaded(true); onGarmentDownloadComplete?.(garment.id); });

        return () => {
             if (garmentRef.current) {
                scene.remove(garmentRef.current);
                garmentRef.current = null;
            }
        }
    }, [garment.modelUrl, garment.id, garment.isRigged, threeCore, onGarmentDownloadComplete]);

    const memoizedLandmarks = landmarksRef.current;
    const memoizedWorldLandmarks = worldLandmarksRef.current;
    const memoizedUserRestPose = userRestPoseRef.current;
    const memoizedIsFlipped = isFlippedRef.current;

    const transform = useAvatarTracking({
      landmarks: memoizedLandmarks,
      worldLandmarks: memoizedWorldLandmarks,
      userRestPose: memoizedUserRestPose,
      modelTorsoHeight,
      rigRestPoints,
      isFlipped: memoizedIsFlipped,
      renderer: threeCore?.renderer,
      camera: threeCore?.camera,
    });

    useEffect(() => {
        let raf: number;
        const tempColor = new THREE.Color();
        
        const animate = () => {
            raf = requestAnimationFrame(animate);
            if (!threeCore || !isAvatarLoaded) return;
            const { renderer, scene, camera, composer, bloomPass, fxaaPass, raycaster, gridHelper, groundPlaneMesh, keyLight, fillLight, backLight, ambientLight } = threeCore;

            const garmentModel = garmentRef.current;
            const canvas = renderer.domElement;
            const video = videoElementRef.current;
            let newTrackingStatus = false;
      
            let currentLandmarks = landmarksRef.current;
            const currentWorldLandmarks = worldLandmarksRef.current;
            const currentGarment = garmentPropRef.current;
            const currentSegmentationData = segmentationDataRef.current;
            const modelIsReady = isModelReadyRef.current;
            const isSourceFlipped = isFlippedRef.current;
            const userPose = userRestPoseRef.current;
            const currentAdjustments = adjustmentsRef.current;
            const currentEstimatedLighting = estimatedLightingRef.current;
            const currentIsDriverVisible = isDriverVisibleRef.current;
            const currentIsLegTrackingEnabled = isLegTrackingEnabledRef.current;
            const currentIkRotationOverrides = ikRotationOverridesRef.current;
            const currentIsAutoRotating = isAutoRotatingRef.current;
            const currentUpperBodyTarget = upperBodyTargetRef.current;
            const currentBendIntensity = bendIntensityRef.current;
            const currentOnModeChange = onModeChangeRef.current;
            const currentAccessory = selectedAccessoryRef.current;
            const currentIsPostProcessingEnabled = isPostProcessingEnabledRef.current;
            
            if (currentLandmarks && video && video.videoWidth > 0) {
              const videoAspect = video.videoWidth / video.videoHeight;
              const canvasAspect = canvas.clientWidth / canvas.clientHeight;
              if (Math.abs(videoAspect - canvasAspect) > 0.01) {
                  currentLandmarks = currentLandmarks.map(lm => remapLandmark(lm, videoAspect, canvasAspect));
              }
            }
            
            groundPlaneMesh.visible = false;
            gridHelper.visible = false;
      
            if (!modelIsReady || !driverModel || !rigRestPoints) { composer.render(); return; }
            if (!garmentModel) { composer.render(); return; }
      
            // --- Dynamic Lighting Update ---
            if (keyLight && fillLight && ambientLight && backLight && currentEstimatedLighting) {
                const lerpFactor = 0.1; // Smoothing factor for light changes
                renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, currentEstimatedLighting.hdriIntensity, lerpFactor);
                
                // Key Light
                keyLight.intensity = THREE.MathUtils.lerp(keyLight.intensity, currentEstimatedLighting.key.intensity, lerpFactor);
                keyLight.position.x = THREE.MathUtils.lerp(keyLight.position.x, currentEstimatedLighting.key.x, lerpFactor);
                keyLight.color.lerp(tempColor.setRGB(currentEstimatedLighting.key.r, currentEstimatedLighting.key.g, currentEstimatedLighting.key.b), lerpFactor);
                
                // Fill Light
                fillLight.intensity = THREE.MathUtils.lerp(fillLight.intensity, currentEstimatedLighting.fill.intensity, lerpFactor);
                fillLight.position.x = THREE.MathUtils.lerp(fillLight.position.x, currentEstimatedLighting.fill.x, lerpFactor);
                fillLight.color.lerp(tempColor.setRGB(currentEstimatedLighting.fill.r, currentEstimatedLighting.fill.g, currentEstimatedLighting.fill.b), lerpFactor);

                // Ambient Light
                ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, currentEstimatedLighting.ambient.intensity, lerpFactor);
                ambientLight.color.lerp(tempColor.setRGB(currentEstimatedLighting.ambient.r, currentEstimatedLighting.ambient.g, currentEstimatedLighting.ambient.b), lerpFactor);
                
                // Back light stays white for separation
                backLight.color.set(0xffffff);
            }

            const hasLandmarks = currentLandmarks && currentLandmarks.length>0;
            const hasWorldLandmarks = currentWorldLandmarks && currentWorldLandmarks.length>0;
            const shouldersAreTracked = isShoulderDetectedRef.current;
            const hipsAreTracked = isHipDetectedRef.current;

            const currentMode = hasWorldLandmarks ? '3D' : '2D';
            if (lastReportedModeRef.current !== currentMode) {
                currentOnModeChange?.(currentMode);
                lastReportedModeRef.current = currentMode;
            }
      
            const showRiggedModel = currentGarment.isRigged && hipsAreTracked && !!userPose;
            const showNonRiggedModel = !currentGarment.isRigged && shouldersAreTracked && !!currentSegmentationData;
      
            if (showRiggedModel) {
              garmentModel.visible = true;
              yBotMeshes.forEach((mesh: THREE.Mesh) => {
                  mesh.visible = true;
                  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  mats.forEach(mat => { (mat as any).colorWrite = !!currentIsDriverVisible; });
              });
            } else if (showNonRiggedModel) {
              garmentModel.visible = true;
              yBotMeshes.forEach((mesh: any) => { (mesh as any).visible = false; });
            } else {
              garmentModel.visible = false;
              yBotMeshes.forEach((mesh: any) => { (mesh as any).visible = false; });
            }
      
            if (showRiggedModel && transform) {
              newTrackingStatus = true;
              let metersToPixels = 1.0; 
      
              if (hipsAreTracked && shouldersAreTracked && userPose && hasLandmarks && modelTorsoHeight && modelTorsoHeight > 0) {
                const { clientWidth: width, clientHeight: height } = renderer.domElement;
                const { position, quaternion, scale } = transform;
        
                if (hasWorldLandmarks) {
                    const lSh = currentLandmarks![landmarkIndex.lSh];
                    const rSh = currentLandmarks![landmarkIndex.rSh];
                    const userShoulderCenterPx = new THREE.Vector2((lSh.x + rSh.x) * 0.5 * width, (lSh.y + rSh.y) * 0.5 * height);
                    const lHp = currentLandmarks![landmarkIndex.lHp];
                    const rHp = currentLandmarks![landmarkIndex.rHp];
                    const userHipCenterPx = new THREE.Vector2((lHp.x + rHp.x) * 0.5 * width, (lHp.y + rHp.y) * 0.5 * height);
                    const userTorsoHeightPx = userShoulderCenterPx.distanceTo(userHipCenterPx);

                    const wlLSh = currentWorldLandmarks![landmarkIndex.lSh];
                    const wlRSh = currentWorldLandmarks![landmarkIndex.rSh];
                    const wlLHp = currentWorldLandmarks![landmarkIndex.lHp];
                    const wlRHp = currentWorldLandmarks![landmarkIndex.rHp];
                    const shoulderCenterM = new THREE.Vector3( (wlLSh.x + wlRSh.x) / 2, (wlLSh.y + wlRSh.y) / 2, (wlLSh.z + wlRSh.z) / 2 );
                    const hipCenterM = new THREE.Vector3( (wlLHp.x + wlRHp.x) / 2, (wlLHp.y + wlRHp.y) / 2, (wlLHp.z + wlRHp.z) / 2 );
                    const userTorsoHeightMeters = shoulderCenterM.distanceTo(hipCenterM);
                    if (userTorsoHeightMeters > 0.1) {
                        metersToPixels = userTorsoHeightPx / userTorsoHeightMeters;
                    }
                }
                
                const finalScaleValue = scale.x * AVATAR_BASE_SCALE * (currentAdjustments?.scale ?? 1.0);
                const targetScaleVec = new THREE.Vector3(finalScaleValue, finalScaleValue, finalScaleValue);

                const desiredModelPos = position.clone();
                if (currentAdjustments) {
                    desiredModelPos.x += currentAdjustments.xOffset * width;
                    desiredModelPos.y -= currentAdjustments.yOffset * height;
                    desiredModelPos.y += currentAdjustments.hipHeightOffset * scale.x; // Use base scale from hook
                }

                let targetRotation = quaternion;
                 if (currentIsAutoRotating) {
                  const rotationSpeed = 0.5;
                  const rotationY = (performance.now() / 1000) * rotationSpeed;
                  targetRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0));
                }
        
                const SMOOTHING_FACTOR = 0.1;
                driverModel.position.lerp(desiredModelPos, SMOOTHING_FACTOR);
                driverModel.quaternion.slerp(targetRotation, SMOOTHING_FACTOR);
                driverModel.scale.lerp(targetScaleVec, SMOOTHING_FACTOR);
              } else {
                newTrackingStatus = false;
              }
              
              driverModel.updateWorldMatrix(true,false);

            // --- Accessory Positioning ---
            const accessoryGroup = accessoryGroupRef.current;
            if (currentAccessory && accessoryGroup && accessoryGroup.children.length > 0) {
                accessoryGroup.visible = true;
                const off = currentAccessory.positionOffset;
                const rot = currentAccessory.rotationOffset;

                // Special case for earrings, which are positioned via landmarks
                if (currentAccessory.isPair && currentAccessory.attachmentBone === 'Head') {
                    const leftEarring = accessoryGroup.children[0];
                    const rightEarring = accessoryGroup.children[1];
                    const headBone = accessoryGroup.parent as THREE.Bone;
                    const hipBone = getBone(driverModel, 'Hips');

                    if (leftEarring && rightEarring && headBone && hipBone && hasWorldLandmarks && metersToPixels && metersToPixels > 0 && driverModel.scale.y > 0) {
                        const modelWorldQuat = new THREE.Quaternion();
                        driverModel.getWorldQuaternion(modelWorldQuat);
                        
                        const hipsWorldPos = new THREE.Vector3();
                        hipBone.getWorldPosition(hipsWorldPos);
                        headBone.updateWorldMatrix(true, false);
                        const headInverseMatrix = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
                        const wlLEar = currentWorldLandmarks![landmarkIndex.lEar];
                        const wlREar = currentWorldLandmarks![landmarkIndex.rEar];

                        const mpToModelWorld = (lm: Landmark) => {
                          const mpVecMeters = new THREE.Vector3(-lm.x, -lm.y, -lm.z);
                          const pxVec = mpVecMeters.multiplyScalar(metersToPixels);
                          pxVec.applyQuaternion(modelWorldQuat);
                          return new THREE.Vector3().copy(hipsWorldPos).add(pxVec);
                        };

                        const leftEarWorld = mpToModelWorld(wlLEar);
                        const rightEarWorld = mpToModelWorld(wlREar);

                        const leftLocal = leftEarWorld.clone().applyMatrix4(headInverseMatrix);
                        const rightLocal = rightEarWorld.clone().applyMatrix4(headInverseMatrix);

                        // Position and orient the earrings in the head bone's local space.
                        const k = driverModel.scale.x; // avatar global scale

                        // Right earring (primary)
                        rightEarring.position.copy(rightLocal).add(new THREE.Vector3(off.x * k, off.y * k, off.z * k));
                        rightEarring.rotation.set(rot.x, rot.y, rot.z);

                        // Left earring (mirrored)
                        leftEarring.position.copy(leftLocal).add(new THREE.Vector3(-off.x * k, off.y * k, off.z * k));
                        leftEarring.rotation.set(rot.x, rot.y + Math.PI, rot.z);

                        // Scale with avatar
                        const s = currentAccessory.scale * k;
                        leftEarring.scale.setScalar(s);
                        rightEarring.scale.setScalar(s);


                    } else {
                        accessoryGroup.visible = false;
                    }
                } else {
                    // Generic logic for single items attached to bones (hats, watches, etc.)
                    // The group is already parented to the bone. We just set local transforms.
                    accessoryGroup.position.set(off.x, off.y, off.z);
                    accessoryGroup.rotation.set(rot.x, rot.y, rot.z);
                    // Accessory scale is relative to the parent bone. The avatar's global scale is inherited.
                    accessoryGroup.scale.setScalar(currentAccessory.scale);

                    // Hide the second item if it exists but is not part of the earring logic
                    if (accessoryGroup.children[1]) {
                        accessoryGroup.children[1].visible = false;
                    }
                }
            } else if (accessoryGroup) {
                accessoryGroup.visible = false;
            }


              // --- NEW: Reset Hips bone to prevent animation/logic drift ---
              const hipsBone = getBone(driverModel, 'Hips');
              if (hipsBone && initialBoneData) {
                  const initialData = initialBoneData.get(hipsBone.name);
                  if (initialData) {
                      hipsBone.position.copy(initialData.position);
                  }
              }
      
              if (hasLandmarks && initialSpineRotations) {
                const { clientWidth: width, clientHeight: height } = renderer.domElement;
                const flipX = isSourceFlipped ? -1 : 1;
                const lSh = currentLandmarks![landmarkIndex.lSh], rSh = currentLandmarks![landmarkIndex.rSh];
                const lHp = currentLandmarks![landmarkIndex.lHp], rHp = currentLandmarks![landmarkIndex.rHp];

                // --- 3D-Aware Spine Twist (inspired by Python example) ---
                const worldLms = worldLandmarksRef.current;
                if (hasWorldLandmarks && worldLms && worldLms.length > 24 && initialSpineRotations.size > 0) {
                    // Prefer 3D world landmarks for robust twist calculation
                    const wl_lSh = new THREE.Vector3(worldLms[landmarkIndex.lSh].x, worldLms[landmarkIndex.lSh].y, worldLms[landmarkIndex.lSh].z);
                    const wl_rSh = new THREE.Vector3(worldLms[landmarkIndex.rSh].x, worldLms[landmarkIndex.rSh].y, worldLms[landmarkIndex.rSh].z);
                    const wl_lHp = new THREE.Vector3(worldLms[landmarkIndex.lHp].x, worldLms[landmarkIndex.lHp].y, worldLms[landmarkIndex.lHp].z);
                    const wl_rHp = new THREE.Vector3(worldLms[landmarkIndex.rHp].x, worldLms[landmarkIndex.rHp].y, worldLms[landmarkIndex.rHp].z);
            
                    const shoulderCenter = new THREE.Vector3().addVectors(wl_lSh, wl_rSh).multiplyScalar(0.5);
                    const hipCenter = new THREE.Vector3().addVectors(wl_lHp, wl_rHp).multiplyScalar(0.5);
                    const torsoAxis = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
            
                    const shoulderVec = new THREE.Vector3().subVectors(wl_rSh, wl_lSh);
                    const hipVec = new THREE.Vector3().subVectors(wl_rHp, wl_lHp);
                    
                    const projShoulderVec = shoulderVec.clone().projectOnPlane(torsoAxis).normalize();
                    const projHipVec = hipVec.clone().projectOnPlane(torsoAxis).normalize();
            
                    let twist = projShoulderVec.angleTo(projHipVec);
                    const cross = new THREE.Vector3().crossVectors(projHipVec, projShoulderVec);
                    if (cross.dot(torsoAxis) < 0) {
                        twist = -twist;
                    }

                    const bones = [getBone(driverModel,'Spine'), getBone(driverModel,'Spine1'), getBone(driverModel,'Spine2')].filter(Boolean) as THREE.Bone[];
                    if (bones.length) {
                        const per = twist/bones.length; 
                        const tq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), per);
                        bones.forEach(b=>{ const ini = initialSpineRotations.get(b.name); if (ini) b.quaternion.copy(ini).multiply(tq); });
                    }

                } else if (lSh && rSh && lHp && rHp && initialSpineRotations.size > 0) {
                    // Fallback to 2D screen-space twist if no world landmarks
                    const shAng = Math.atan2(rSh.y-lSh.y, (rSh.x-lSh.x)*flipX);
                    const hpAng = Math.atan2(rHp.y-lHp.y, (rHp.x-lHp.x)*flipX);
                    let twist = shAng - hpAng; while (twist>Math.PI) twist-=2*Math.PI; while (twist<-Math.PI) twist+=2*Math.PI;
                    const bones = [getBone(driverModel,'Spine'), getBone(driverModel,'Spine1'), getBone(driverModel,'Spine2')].filter(Boolean) as THREE.Bone[];
                    if (bones.length) {
                        const per = twist/bones.length; const tq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), per);
                        bones.forEach(b=>{ const ini = initialSpineRotations.get(b.name); if (ini) b.quaternion.copy(ini).multiply(tq); });
                    }
                }
      
                // --- Manual Torso Rotation (FK Override) ---
                if (currentIkRotationOverrides && initialBoneData) {
                    const applyRotation = (boneName: string, rotation: {x:number, y:number, z:number} | undefined) => {
                        if (!rotation) return;
                        if (rotation.x === 0 && rotation.y === 0 && rotation.z === 0) return;
                        
                        const bone = getBone(driverModel, boneName);
                        if (!bone) return;
                        
                        const initialData = initialBoneData.get(bone.name);
                        if (!initialData) return;
          
                        const overrideEuler = new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ');
                        const overrideQuat = new THREE.Quaternion().setFromEuler(overrideEuler);
          
                        bone.quaternion.copy(initialData.quaternion).multiply(overrideQuat);
                    };
            
                    applyRotation('Hips', currentIkRotationOverrides.hips);
                    applyRotation('Spine', currentIkRotationOverrides.spine);
                    applyRotation('Spine1', currentIkRotationOverrides.spine1);
                    applyRotation('Spine2', currentIkRotationOverrides.spine2);
                }
// --- START: Upper Body IK Bend ---
if (currentBendIntensity && currentBendIntensity > 0 && driverModel && initialBoneData && currentUpperBodyTarget) {
  const hipsBone = getBone(driverModel, 'Hips');

  // ▼ Add this facing test + scaled bend RIGHT HERE
  const camFwd = new THREE.Vector3(); 
  camera.getWorldDirection(camFwd).multiplyScalar(-1);
  const worldLms = worldLandmarksRef.current;
  let bendFactorIk = 1.0;
  if (worldLms && worldLms.length > 24) {
    const wlLSh = worldLms[landmarkIndex.lSh], wlRSh = worldLms[landmarkIndex.rSh];
    const wlLHp = worldLms[landmarkIndex.lHp], wlRHp = worldLms[landmarkIndex.rHp];
    const vLSh = new THREE.Vector3(wlLSh.x, wlLSh.y, wlLSh.z), vRSh = new THREE.Vector3(wlRSh.x, wlRSh.y, wlRSh.z);
    const vLHp = new THREE.Vector3(wlLHp.x, wlLHp.y, wlLHp.z), vRHp = new THREE.Vector3(wlRHp.x, wlRHp.y, wlRHp.z);
    const shoulderCenter = new THREE.Vector3().addVectors(vLSh, vRSh).multiplyScalar(0.5);
    const hipCenter = new THREE.Vector3().addVectors(vLHp, vRHp).multiplyScalar(0.5);
    const xAxis = new THREE.Vector3().subVectors(vRSh, vLSh).normalize();
    const yAxis = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    const bodyFwd = zAxis.normalize();
    const facingDot = THREE.MathUtils.clamp(bodyFwd.dot(camFwd), -1, 1);
    bendFactorIk = THREE.MathUtils.smoothstep(facingDot, -0.2, 0.4);
  }
  const scaledBend = currentBendIntensity * bendFactorIk;
  // ▲ End added block

  if (hipsBone) {
    const spineBones = ['Spine', 'Spine1', 'Spine2']
      .map(name => getBone(driverModel, name))
      .filter(Boolean) as THREE.Bone[];

    if (spineBones.length > 0) {
      // use scaledBend instead of currentBendIntensity
      const perBoneIntensity = scaledBend / spineBones.length;
      const dummy = new THREE.Object3D();

      const targetWorldPosition = new THREE.Vector3();
      hipsBone.getWorldPosition(targetWorldPosition);
      
      const modelQuat = new THREE.Quaternion();
      driverModel.getWorldQuaternion(modelQuat);

      const offset = new THREE.Vector3(currentUpperBodyTarget.x, currentUpperBodyTarget.y, currentUpperBodyTarget.z);
      offset.multiplyScalar(driverModel.scale.y);
      offset.applyQuaternion(modelQuat);
      targetWorldPosition.add(offset);

      for (const bone of spineBones) {
          const parent = bone.parent;
          if (!parent) continue;

          const boneWorldPos = new THREE.Vector3();
          bone.getWorldPosition(boneWorldPos);
          
          const parentWorldQuat = new THREE.Quaternion();
          parent.getWorldQuaternion(parentWorldQuat);

          dummy.position.copy(boneWorldPos);
          dummy.up.set(0, 1, 0).applyQuaternion(parentWorldQuat);
          dummy.lookAt(targetWorldPosition);
          
          const lookAtQuat = dummy.quaternion;
          const currentWorldQuat = new THREE.Quaternion();
          bone.getWorldQuaternion(currentWorldQuat);
          // Slerp from current world rotation to lookAt rotation
          const finalWorldQuat = currentWorldQuat.clone().slerp(lookAtQuat, perBoneIntensity);
          
          // Convert back to local space for the bone
          const finalLocalQuat = parentWorldQuat.clone().invert().multiply(finalWorldQuat);

          bone.quaternion.copy(finalLocalQuat);
          
          // Update matrices immediately for the next bone in the chain
          driverModel.updateWorldMatrix(true, false);
      }
    }
  }
}
// --- END: Upper Body IK Bend ---

                // --- Rotation-Aware Head Look ---
                let lookAtInfluence = 1.0;
                if (userPose && lSh && rSh && userPose.shoulderWidth2D > 0) {
                    const currentShoulderWidth2D = Math.abs(lSh.x - rSh.x);
                    const shoulderRatio = Math.min(1.0, currentShoulderWidth2D / userPose.shoulderWidth2D);
                    // Fade out the 'lookAt' effect as the user turns sideways.
                    // Full effect above 80% width, fades to zero by 40% width.
                    lookAtInfluence = THREE.MathUtils.smoothstep(shoulderRatio, 0.4, 0.8);
                }
                
                const head = getBone(driverModel,'Head');
                const neck = getBone(driverModel,'Neck');
                const nose = currentLandmarks![landmarkIndex.nose];
                if (head && head.parent && neck && nose && initialBoneData && initialBoneData.has(head.name)) {
                    // The head's "natural" rotation is its initial rotation from the bind pose.
                    const baseRotation = initialBoneData.get(head.name)!.quaternion;
                    let finalRotation = baseRotation;
        
                    if (lookAtInfluence > 0.01) {
                        // Calculate the target rotation for looking at the camera
                        const parentQ = new THREE.Quaternion(); neck.getWorldQuaternion(parentQ);
                        const worldUp = new THREE.Vector3(0,1,0).applyQuaternion(parentQ);
                        const headPos = new THREE.Vector3(); head.getWorldPosition(headPos);
                        const lookAtTarget = new THREE.Vector3((nose.x-0.5)*width*flipX, -(nose.y-0.5)*height, headPos.z + nose.z*width*-1);
                        
                        const dummy = new THREE.Object3D();
                        dummy.position.copy(headPos);
                        dummy.up.copy(worldUp);
                        dummy.lookAt(lookAtTarget);
                        
                        const headParentQ = new THREE.Quaternion(); head.parent.getWorldQuaternion(headParentQ);
                        const lookAtLocalQ = headParentQ.invert().multiply(dummy.quaternion);
        
                        // Blend between the natural rotation and the look-at rotation
                        finalRotation = baseRotation.clone().slerp(lookAtLocalQ, lookAtInfluence);
                    }
                    
                    // Apply the blended rotation
                    head.quaternion.slerp(finalRotation, 0.4);
                }
              }
      
               // --- START: FORWARD KINEMATICS (FK) RETARGETING ---
               const applyFkRotation = (boneName: string, userStartLm: Landmark, userEndLm: Landmark) => {
                const bone = getBone(driverModel, boneName);
                const parent = bone?.parent as THREE.Bone;
                if (!bone || !parent) return;

                // 1. Get user's limb vector in world space.
                let userVec: THREE.Vector3;
                if (hasWorldLandmarks) {
                    const userVecMP = new THREE.Vector3(userEndLm.x - userStartLm.x, userEndLm.y - userStartLm.y, userEndLm.z - userStartLm.z);
                    // Convert MediaPipe world space direction to Three.js world space direction
                    // FIX: Invert Y-axis to correct for mirrored movement.
                    userVec = new THREE.Vector3(-userVecMP.x, -userVecMP.y, -userVecMP.z).normalize();
                } else { // 2D Fallback
                    const { clientWidth: width, clientHeight: height } = renderer.domElement;
                    const flipX = isSourceFlipped ? -1 : 1;
                    // FIX: Invert Y-axis for 2D fallback as well by removing the negation.
                    const startScreen = new THREE.Vector3((userStartLm.x - 0.5) * width * flipX, (userStartLm.y - 0.5) * height, 0);
                    const endScreen = new THREE.Vector3((userEndLm.x - 0.5) * width * flipX, (userEndLm.y - 0.5) * height, 0);
                    userVec = new THREE.Vector3().subVectors(endScreen, startScreen).normalize();
                }

                if (userVec.lengthSq() < 0.1) return; // Skip if vector is too small

                // 2. Get model's current limb vector in world space.
                const bonePos = new THREE.Vector3();
                bone.getWorldPosition(bonePos);
                
                let childPos = new THREE.Vector3();
                if (bone.children.length > 0 && bone.children[0] instanceof THREE.Bone) {
                    (bone.children[0] as THREE.Bone).getWorldPosition(childPos);
                } else {
                    // Fallback for end effectors (e.g., Hand, Foot)
                    const localDir = new THREE.Vector3(0, 0.1, 0); // Assume a small vector along local Y
                    bone.localToWorld(localDir);
                    childPos.copy(localDir);
                }
                const modelVec = new THREE.Vector3().subVectors(childPos, bonePos).normalize();
                if (modelVec.lengthSq() < 0.1) return;

                // 3. Calculate rotation from model vector to user vector.
                const rot = new THREE.Quaternion().setFromUnitVectors(modelVec, userVec);
                
                // 4. Apply this rotation to the bone's current world rotation.
                const currentQuat = new THREE.Quaternion();
                bone.getWorldQuaternion(currentQuat);
                const targetQuat = rot.multiply(currentQuat);
                
                // 5. Convert back to local space and apply.
                const parentQuat = new THREE.Quaternion();
                parent.getWorldQuaternion(parentQuat);
                const localTargetQuat = parentQuat.invert().multiply(targetQuat);
                
                bone.quaternion.slerp(localTargetQuat, 0.6);
            };

            if (hasLandmarks && initialBoneData) {
                driverModel.updateWorldMatrix(true, false); // Update after spine is set

                const lms = hasWorldLandmarks ? currentWorldLandmarks! : currentLandmarks!;
                const flipped = isSourceFlipped;

                applyFkRotation('LeftArm', lms[LR(flipped, 11, 12)], lms[LR(flipped, 13, 14)]);
                applyFkRotation('RightArm', lms[LR(flipped, 12, 11)], lms[LR(flipped, 14, 13)]);
                driverModel.updateWorldMatrix(true, false); // Update between chained bones

                applyFkRotation('LeftForeArm', lms[LR(flipped, 13, 14)], lms[LR(flipped, 15, 16)]);
                applyFkRotation('RightForeArm', lms[LR(flipped, 14, 13)], lms[LR(flipped, 16, 15)]);
                
                if(currentIsLegTrackingEnabled) {
                    driverModel.updateWorldMatrix(true, false);
                    applyFkRotation('LeftUpLeg', lms[LR(flipped, 23, 24)], lms[LR(flipped, 25, 26)]);
                    applyFkRotation('RightUpLeg', lms[LR(flipped, 24, 23)], lms[LR(flipped, 26, 25)]);
                    driverModel.updateWorldMatrix(true, false);
                    applyFkRotation('LeftLeg', lms[LR(flipped, 25, 26)], lms[LR(flipped, 27, 28)]);
                    applyFkRotation('RightLeg', lms[LR(flipped, 26, 25)], lms[LR(flipped, 28, 27)]);
                }
            }
            // --- END: FORWARD KINEMATICS (FK) RETARGETING ---

            } else if (showNonRiggedModel) {
              newTrackingStatus = true;
              const { clientWidth: width, clientHeight: height } = renderer.domElement;
              const baseTargetX = (currentSegmentationData!.centerX - 0.5) * width * (isFlipped ? -1 : 1);
              let baseScale = currentSegmentationData!.width * width;
              const detectedBodyHeight = currentSegmentationData!.height * height;
              const maskTopYNormalized = currentSegmentationData!.centerY - (currentSegmentationData!.height / 2);
              const shoulderLineY = -((maskTopYNormalized - 0.5) * height);
              const verticalDrop = detectedBodyHeight * currentGarment.yOffset;
              let baseTargetY = shoulderLineY - verticalDrop;
      
              // roll (Z) from 2D shoulders as before
              let baseAngle = 0;
              if (hasLandmarks) {
                const lS = currentLandmarks![landmarkIndex.lSh];
                const rS = currentLandmarks![landmarkIndex.rSh];
                if (lS && rS) {
                  if (isFlipped) {
                    const ml = 1-lS.x, mr = 1-rS.x; const dy = lS.y-rS.y; const dx = ml-mr; baseAngle = Math.atan2(dy*height, dx*width);
                  } else {
                    const dy = rS.y-lS.y; const dx = rS.x-lS.x; baseAngle = Math.atan2(dy*height, dx*width);
                  }
                }
              }

              // yaw (Y) from world shoulders if available
              let yawY = Math.PI;
              if (hasWorldLandmarks) {
                const wLSh = currentWorldLandmarks![landmarkIndex.lSh];
                const wRSh = currentWorldLandmarks![landmarkIndex.rSh];
                if (wLSh && wRSh) yawY = yawFromWorldShoulders(wLSh, wRSh);
              }
              
              let finalRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yawY, baseAngle, 'XYZ'));
      
              if (currentAdjustments) {
                  baseScale *= currentAdjustments.scale;
                  const finalTargetX = baseTargetX + currentAdjustments.xOffset * width;
                  baseTargetY -= currentAdjustments.yOffset * height;
      
                  const adjustQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(currentAdjustments.rotation.x, currentAdjustments.rotation.y, currentAdjustments.rotation.z, 'XYZ'));
                  finalRotation.multiply(adjustQuat);
                  
                  const pos = new THREE.Vector3(finalTargetX + (width * currentGarment.xOffset), baseTargetY, 0);
                  const sclVal = (garmentModel.userData.normalizationScale || 1) * baseScale * currentGarment.scale;
                  const scl = new THREE.Vector3(sclVal,sclVal,sclVal);
                  garmentModel.position.lerp(pos,0.4); garmentModel.scale.lerp(scl,0.4);
              } else {
                  const pos = new THREE.Vector3(baseTargetX + (width * currentGarment.xOffset), baseTargetY, 0);
                  const sclVal = (garmentModel.userData.normalizationScale || 1) * baseScale * currentGarment.scale;
                  const scl = new THREE.Vector3(sclVal,sclVal,sclVal);
                  garmentModel.position.lerp(pos,0.4); garmentModel.scale.lerp(scl,0.4);
              }

              const prevQuatRefKey = '__prevQuatRef';
              const anyModel = garmentModel as any;
              if (!anyModel[prevQuatRefKey]) anyModel[prevQuatRefKey] = finalRotation.clone();
              const smoothed = (anyModel[prevQuatRefKey] as THREE.Quaternion).clone().slerp(finalRotation, 0.35);
              anyModel[prevQuatRefKey].copy(smoothed);
              garmentModel.quaternion.slerp(smoothed, 0.4);
            } else {
              newTrackingStatus = false;
            }
      
            if (lastTrackingStatusRef.current !== newTrackingStatus) {
              onTrackingStatusChange(newTrackingStatus);
              lastTrackingStatusRef.current = newTrackingStatus;
            }
      
            let modelHipScreenPosition: { x: number; y: number } | null = null;
            let hipDistance: number | null = null;
            if (showRiggedModel && (currentLandmarks?.length ?? 0) > 0) {
              const hipBone = getBone(driverModel!, 'Hips');
              if (hipBone && camera) {
                const hipWorldPosition = new THREE.Vector3(); hipBone.getWorldPosition(hipWorldPosition);
                const screen = hipWorldPosition.clone().project(camera);
                const modelHipNormX = screen.x*0.5 + 0.5;
                const modelHipNormY = -screen.y*0.5 + 0.5;
                modelHipScreenPosition = { x:modelHipNormX, y:modelHipNormY };
                const lHip = currentLandmarks![landmarkIndex.lHp]; const rHip = currentLandmarks![landmarkIndex.rHp];
                if (lHip && rHip) {
                  const userX = (lHip.x + rHip.x)/2; const userY = (lHip.y + rHip.y)/2;
                  hipDistance = Math.hypot(userX - modelHipNormX, userY - modelHipNormY);
                }
              }
            }
            onDebugDataUpdateRef.current?.({ modelHipScreenPosition, hipDistance });
      
            if (bloomPass) bloomPass.enabled = !!currentIsPostProcessingEnabled;
            if (fxaaPass) fxaaPass.enabled = !!currentIsPostProcessingEnabled;
            
            composer.render();
        };

        let rafId: number;
        if(threeCore) {
            rafId = requestAnimationFrame(animate);
        }
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
        }
    }, [
        threeCore, isAvatarLoaded, onTrackingStatusChange, videoElement,
        landmarksRef, worldLandmarksRef, garmentPropRef, segmentationDataRef,
        isModelReadyRef, isFlippedRef, userRestPoseRef, 
        adjustmentsRef, estimatedLightingRef, isDriverVisibleRef, isLegTrackingEnabledRef, ikRotationOverridesRef, isAutoRotatingRef,
        upperBodyTargetRef, bendIntensityRef, selectedAccessoryRef,
        onDebugDataUpdateRef, driverModel, yBotMeshes,
        rigRestPoints, hipAnchorLocal, initialSpineRotations, initialBoneData,
        modelTorsoHeight, isPostProcessingEnabledRef, transform
    ]);

    return <div ref={mountRef} className="absolute z-20" style={containerStyle || { inset: 0 }} />;
});
