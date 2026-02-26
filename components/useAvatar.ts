import { useState, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getBone } from './threeUtils';
import { Y_BOT_URL } from '../constants';
import { ManualIKState } from '../types';

const POSE_POINT_NAMES = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'leftToe', 'rightToe'];
const BONE_NAME_MAP: { [key: string]: string } = {
  leftShoulder: 'LeftShoulder', rightShoulder: 'RightShoulder', leftElbow: 'LeftArm', rightElbow: 'RightArm', leftWrist: 'LeftHand', rightWrist: 'RightHand',
  leftHip: 'LeftUpLeg', rightHip: 'RightUpLeg', leftKnee: 'LeftLeg', rightKnee: 'RightLeg', leftAnkle: 'LeftFoot', rightAnkle: 'RightFoot',
  leftToe: 'LeftToeBase', rightToe: 'RightToeBase'
};

export interface AvatarData {
    driverModel: THREE.Group;
    yBotMeshes: THREE.Object3D[];
    hipAnchorLocal: THREE.Vector3;
    rigRestPoints: { [k: string]: THREE.Vector3 };
    initialSpineRotations: Map<string, THREE.Quaternion>;
    collisionSpheres: THREE.Sphere[];
    initialBoneData: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; }>;
    modelTorsoHeight: number;
}

export const useAvatar = (scene: THREE.Scene | null, defaultIKPose?: ManualIKState, avatarUrl?: string) => {
    const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
    const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);

    useEffect(() => {
        if (!scene || isAvatarLoaded) return;
        
        let isMounted = true;
        const loader = new GLTFLoader();
        
        const modelUrl = avatarUrl || Y_BOT_URL;
        
        loader.load(modelUrl, 
        (gltf) => {
            if (!isMounted) return;
            
            const model = gltf.scene;
            // The component using this hook is now responsible for adding the model to the scene.
            
            const yBotMeshes: THREE.Object3D[] = [];
            let skinnedMesh: THREE.SkinnedMesh | null = null;
            
            model.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    yBotMeshes.push(child);
                    child.renderOrder = 0;
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => { (mat as any).depthWrite = true; });
                    if (child instanceof THREE.SkinnedMesh && !skinnedMesh) skinnedMesh = child;
                }
            });

            model.updateWorldMatrix(true, true);
            
            const hipAnchorLocal = new THREE.Vector3();
            const hips = getBone(model, 'Hips');
            if (hips) {
                const hipsWorld = new THREE.Vector3();
                hips.getWorldPosition(hipsWorld);
                hipAnchorLocal.copy(model.worldToLocal(hipsWorld));
            }

            const rigRestPoints: { [k: string]: THREE.Vector3 } = {};
            POSE_POINT_NAMES.forEach(n => {
                const boneName = BONE_NAME_MAP[n];
                const bone = getBone(model, boneName);
                if (bone) {
                    const wp = new THREE.Vector3();
                    bone.getWorldPosition(wp);
                    rigRestPoints[n] = wp;
                }
            });

            const modelShoulderL = rigRestPoints.leftShoulder;
            const modelShoulderR = rigRestPoints.rightShoulder;
            const modelHipL = rigRestPoints.leftHip;
            const modelHipR = rigRestPoints.rightHip;
            let modelTorsoHeight = 0;

            if (modelShoulderL && modelShoulderR && modelHipL && modelHipR) {
                const modelShoulderCenter = new THREE.Vector3().addVectors(modelShoulderL, modelShoulderR).multiplyScalar(0.5);
                const modelHipCenter = new THREE.Vector3().addVectors(modelHipL, modelHipR).multiplyScalar(0.5);
                modelTorsoHeight = modelShoulderCenter.distanceTo(modelHipCenter);
            }

            const initialSpineRotations = new Map<string, THREE.Quaternion>();
            const collisionSpheres: THREE.Sphere[] = [];
            const initialBoneData = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3; }>();

            if (skinnedMesh) {
                // Capture initial bone transforms before any modifications are made.
                skinnedMesh.skeleton.bones.forEach(bone => {
                    initialBoneData.set(bone.name, {
                        position: bone.position.clone(),
                        quaternion: bone.quaternion.clone(),
                        scale: bone.scale.clone(),
                    });
                });

                ['Spine', 'Spine1', 'Spine2'].forEach(name => {
                    const b = getBone(model, name);
                    if (b) initialSpineRotations.set(b.name, b.quaternion.clone());
                });

                 // Create collision spheres for cloth simulation
                const sphereBones: {[key:string]: number} = {
                    'Head': 0.15, 'Hips': 0.18, 'Spine2': 0.15,
                    'LeftArm': 0.08, 'RightArm': 0.08,
                    'LeftForeArm': 0.08, 'RightForeArm': 0.08,
                    'LeftUpLeg': 0.12, 'RightUpLeg': 0.12,
                    'LeftLeg': 0.12, 'RightLeg': 0.12,
                };
                Object.entries(sphereBones).forEach(([boneName, radius]) => {
                    const bone = getBone(model, boneName);
                    if (bone) {
                        const sphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.7); // 1.7 is y_bot scale
                        // @ts-ignore
                        sphere.userData = { bone }; // Attach bone for easy update access
                        collisionSpheres.push(sphere);
                    }
                });
            }

            setAvatarData({
                driverModel: model,
                yBotMeshes,
                hipAnchorLocal,
                rigRestPoints,
                initialSpineRotations,
                collisionSpheres,
                initialBoneData,
                modelTorsoHeight,
            });
            setIsAvatarLoaded(true);
        },
        (xhr) => { // onProgress
            const percentLoaded = (xhr.loaded / xhr.total * 100).toFixed(2);
            console.log(`Loading avatar model from ${modelUrl}: ${percentLoaded}% loaded.`);
        },
        (err) => {
            console.error(`Failed to load avatar model from ${modelUrl}`, err);
            const errorDetails = err instanceof Error ? err.message : JSON.stringify(err);
            console.error(`This might be a 404 Not Found error. Check if the file exists at the specified URL and that the server is configured to serve .glb files. Error details: ${errorDetails}`);
        });

        return () => { isMounted = false; };
    }, [scene, isAvatarLoaded, defaultIKPose, avatarUrl]);

    return { ...avatarData, isAvatarLoaded };
};
