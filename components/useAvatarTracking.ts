import { useMemo } from 'react';
import * as THREE from 'three';
import { PoseLandmarks, UserRestPose } from '../types';

const landmarkIndex = { lSh: 11, rSh: 12, lHp: 23, rHp: 24 };
const AVATAR_BASE_SCALE = 1.0;

interface UseAvatarTrackingProps {
    landmarks: PoseLandmarks | null;
    worldLandmarks: PoseLandmarks | null;
    userRestPose: UserRestPose | null;
    modelTorsoHeight: number | undefined;
    rigRestPoints: { [k: string]: THREE.Vector3 } | undefined;
    isFlipped: boolean;
    renderer: THREE.WebGLRenderer | undefined;
    camera: THREE.Camera | undefined;
}

export const useAvatarTracking = ({
    landmarks,
    worldLandmarks,
    userRestPose,
    modelTorsoHeight,
    rigRestPoints,
    isFlipped,
    renderer,
    camera,
}: UseAvatarTrackingProps) => {

    const transform = useMemo(() => {
        if (
            !landmarks || landmarks.length === 0 ||
            !userRestPose || !modelTorsoHeight || modelTorsoHeight <= 0 ||
            !rigRestPoints?.leftHip || !rigRestPoints?.rightHip || !renderer || !camera
        ) {
            return null;
        }

        const hasWorldLandmarks = worldLandmarks && worldLandmarks.length > 0;
        const { clientWidth: width, clientHeight: height } = renderer.domElement;
        const flipX = isFlipped ? -1 : 1;

        const lSh = landmarks[landmarkIndex.lSh];
        const rSh = landmarks[landmarkIndex.rSh];
        const lHp = landmarks[landmarkIndex.lHp];
        const rHp = landmarks[landmarkIndex.rHp];

        if (!lSh || !rSh || !lHp || !rHp) return null;

        // --- 1. SCALE based on torso height ---
        const userShoulderCenterPx = new THREE.Vector2((lSh.x + rSh.x) * 0.5 * width, (lSh.y + rSh.y) * 0.5 * height);
        const userHipCenterPx = new THREE.Vector2((lHp.x + rHp.x) * 0.5 * width, (lHp.y + rHp.y) * 0.5 * height);
        const userTorsoHeightPx = userShoulderCenterPx.distanceTo(userHipCenterPx);
        
        const targetScale = userTorsoHeightPx / modelTorsoHeight;
        const finalScaleValue = targetScale * AVATAR_BASE_SCALE;
        const scale = new THREE.Vector3(finalScaleValue, finalScaleValue, finalScaleValue);

        // --- 2. ROTATION ---
        let quaternion: THREE.Quaternion;
        const rollAngleRaw = -Math.atan2((rSh.y - lSh.y) * height, (rSh.x - lSh.x) * width * flipX);
    
        if (hasWorldLandmarks) {
            const wlLSh = worldLandmarks![landmarkIndex.lSh], wlRSh = worldLandmarks![landmarkIndex.rSh];
            const wlLHp = worldLandmarks![landmarkIndex.lHp], wlRHp = worldLandmarks![landmarkIndex.rHp];
            const vLSh = new THREE.Vector3(wlLSh.x, wlLSh.y, wlLSh.z), vRSh = new THREE.Vector3(wlRSh.x, wlRSh.y, wlRSh.z);
            const vLHp = new THREE.Vector3(wlLHp.x, wlLHp.y, wlLHp.z), vRHp = new THREE.Vector3(wlRHp.x, wlRHp.y, wlRHp.z);
            const shoulderCenter = new THREE.Vector3().addVectors(vLSh, vRSh).multiplyScalar(0.5);
            const hipCenter = new THREE.Vector3().addVectors(vLHp, vRHp).multiplyScalar(0.5);
            const xAxis = new THREE.Vector3().subVectors(vRSh, vLSh).normalize();
            const yAxis = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
            const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
            yAxis.crossVectors(zAxis, xAxis).normalize();
            const fwd = new THREE.Vector3(zAxis.x, 0, zAxis.z).normalize();
            const yawAngle = fwd.lengthSq() > 1e-6 ? Math.atan2(fwd.x, fwd.z) : -Math.atan2((wlLSh.z - wlRSh.z), (wlLSh.x - wlRSh.x));
            const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawAngle);
            const camFwd = new THREE.Vector3(); camera.getWorldDirection(camFwd).multiplyScalar(-1);
            const bodyFwd = new THREE.Vector3(zAxis.x, zAxis.y, zAxis.z).normalize();
            const facingDot = THREE.MathUtils.clamp(bodyFwd.dot(camFwd), -1, 1);
            const bendFactor = THREE.MathUtils.smoothstep(facingDot, -0.2, 0.4);
            const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollAngleRaw * bendFactor);
            quaternion = yawQuat.multiply(rollQuat);
        } else {
            const yawToCamera = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
            const smallRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollAngleRaw * 0.5);
            quaternion = yawToCamera.multiply(smallRoll);
        }

        // --- 3. POSITION ---
        const userHipScreenX = ((lHp.x + rHp.x) * 0.5 - 0.5) * width * flipX;
        let userHipScreenY = -((lHp.y + rHp.y) * 0.5 - 0.5) * height;
        const VERTICAL_ALIGNMENT_FACTOR = 0.04;
        const verticalFineTuneOffset = userTorsoHeightPx * VERTICAL_ALIGNMENT_FACTOR;
        userHipScreenY += verticalFineTuneOffset;
        const userHipTargetPos = new THREE.Vector3(userHipScreenX, userHipScreenY, 0);

        const modelHipL = rigRestPoints.leftHip;
        const modelHipR = rigRestPoints.rightHip;
        const modelHipCenterLocal = new THREE.Vector3().addVectors(modelHipL, modelHipR).multiplyScalar(0.5);
        
        const hipOffsetVector = modelHipCenterLocal.clone()
            .applyQuaternion(quaternion)
            .multiply(scale);
        
        const position = new THREE.Vector3().subVectors(userHipTargetPos, hipOffsetVector);

        return { position, quaternion, scale };

    }, [landmarks, worldLandmarks, userRestPose, modelTorsoHeight, rigRestPoints, isFlipped, renderer, camera]);

    return transform;
};