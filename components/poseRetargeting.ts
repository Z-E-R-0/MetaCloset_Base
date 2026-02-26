import * as THREE from 'three';
import { Landmark, PoseLandmarks, UserRestPose, LimbVector } from '../types';

// Helper to get a bone by name from the model's skeleton.
// MOVED to threeUtils.ts to prevent circular dependency


const createLimbVector = (startLm: Landmark, endLm: Landmark): LimbVector => {
    const startVec = new THREE.Vector3(startLm.x, startLm.y, startLm.z);
    const endVec = new THREE.Vector3(endLm.x, endLm.y, endLm.z);
    
    const direction = new THREE.Vector3().subVectors(endVec, startVec);
    const length = direction.length();
    direction.normalize();

    return { start: startLm, end: endLm, direction, length };
};

export const calculateUserRestPose = (landmarks: PoseLandmarks): UserRestPose => {
    const lm = landmarks;
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftElbow = lm[13];
    const rightElbow = lm[14];
    const leftWrist = lm[15];
    const rightWrist = lm[16];
    const leftHip = lm[23];
    const rightHip = lm[24];
    const leftKnee = lm[25];
    const rightKnee = lm[26];
    const leftAnkle = lm[27];
    const rightAnkle = lm[28];
    const leftToe = lm[31];
    const rightToe = lm[32];
    
    const hipCenter: Landmark = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
        z: (leftHip.z + rightHip.z) / 2,
        visibility: Math.min(leftHip.visibility ?? 1, rightHip.visibility ?? 1),
    };
    
    const shoulderCenter: Landmark = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        z: (leftShoulder.z + rightShoulder.z) / 2,
        visibility: Math.min(leftShoulder.visibility ?? 1, rightShoulder.visibility ?? 1),
    };

    const shoulderWidth2D = Math.abs(leftShoulder.x - rightShoulder.x);
    const torsoHeight2D = Math.abs(shoulderCenter.y - hipCenter.y);
    const torsoDiagonal2D = Math.hypot(leftShoulder.x - rightHip.x, leftShoulder.y - rightHip.y);

    return {
        leftUpperArm: createLimbVector(leftShoulder, leftElbow),
        leftLowerArm: createLimbVector(leftElbow, leftWrist),
        rightUpperArm: createLimbVector(rightShoulder, rightElbow),
        rightLowerArm: createLimbVector(rightElbow, rightWrist),
        leftUpperLeg: createLimbVector(leftHip, leftKnee),
        leftLowerLeg: createLimbVector(leftKnee, leftAnkle),
        rightUpperLeg: createLimbVector(rightHip, rightKnee),
        rightLowerLeg: createLimbVector(rightKnee, rightAnkle),
        leftFoot: createLimbVector(leftAnkle, leftToe),
        rightFoot: createLimbVector(rightAnkle, rightToe),
        torso: createLimbVector(hipCenter, shoulderCenter),
        shoulderToShoulder: createLimbVector(leftShoulder, rightShoulder),
        shoulderWidth2D,
        torsoHeight2D,
        torsoDiagonal2D,
        points: {
            leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16,
            leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
            leftToe: 31, rightToe: 32,
        }
    };
};

/**
 * --- UMAYAMA ALGORITHM IMPLEMENTATION ---
 * Computes the optimal similarity transform (scale, rotation, translation)
 * between two sets of 3D points.
 * Based on the paper: "Least-squares estimation of transformation parameters
 * between two point patterns" by Shinji Umeyama.
 */

export const umeyamaWeighted = (
    src: THREE.Vector3[],
    dst: THREE.Vector3[],
    w?: number[]
): { s: number; R: THREE.Matrix3; t: THREE.Vector3 } => {
    const n = src.length;
    const weights = w && w.length === n ? w : Array(n).fill(1);
    const W = weights.reduce((a, b) => a + b, 0);

    // Weighted centroids
    const muS = new THREE.Vector3();
    const muD = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
        muS.addScaledVector(src[i], weights[i]);
        muD.addScaledVector(dst[i], weights[i]);
    }
    muS.multiplyScalar(1 / W);
    muD.multiplyScalar(1 / W);

    // Covariance matrix and source/destination variances
    let sigma2S = 0;
    let sigma2D = 0; // Variance of the destination point cloud
    const C = new THREE.Matrix3().set(0,0,0,0,0,0,0,0,0);
    for (let i = 0; i < n; i++) {
        const p = src[i].clone().sub(muS);
        const q = dst[i].clone().sub(muD);
        sigma2S += weights[i] * p.lengthSq();
        sigma2D += weights[i] * q.lengthSq();
        
        const te = C.elements;
        te[0] += weights[i] * q.x * p.x; te[3] += weights[i] * q.x * p.y; te[6] += weights[i] * q.x * p.z;
        te[1] += weights[i] * q.y * p.x; te[4] += weights[i] * q.y * p.y; te[7] += weights[i] * q.y * p.z;
        te[2] += weights[i] * q.z * p.x; te[5] += weights[i] * q.z * p.y; te[8] += weights[i] * q.z * p.z;
    }
    sigma2S /= W;
    sigma2D /= W;
    C.multiplyScalar(1/W);

    // SVD of Covariance Matrix C = U * S * V^T
    // We use a workaround since THREE.Matrix3 doesn't have a direct SVD.
    // We can use Matrix4.decompose for an approximation of polar decomposition
    const tempMatrix = new THREE.Matrix4().set(
        C.elements[0], C.elements[3], C.elements[6], 0,
        C.elements[1], C.elements[4], C.elements[7], 0,
        C.elements[2], C.elements[5], C.elements[8], 0,
        0, 0, 0, 1
    );

    const U = new THREE.Matrix4();
    const S_decomposed = new THREE.Vector3(); // Not true singular values, just scaling part of decomposition
    const V = new THREE.Matrix4();
    // This is not a true SVD, but a polar decomposition. U becomes the rotation part,
    // and S becomes the scaling part of the polar decomposition. For Umeyama, this U
    // is what we need for the rotation calculation.
    tempMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion().setFromRotationMatrix(U), S_decomposed);

    let R = new THREE.Matrix3().setFromMatrix4(U);
    const det_R = R.determinant();

    if (det_R < 0) {
        // Fix reflection case
        const E = new THREE.Matrix3().set(1, 0, 0, 0, 1, 0, 0, 0, -1);
        R.multiply(E);
    }

    // --- SCALE CALCULATION ---
    // The previous method using the trace of the decomposed scale matrix was unreliable.
    // A more robust method is to use the ratio of the variances of the two point clouds.
    const s = (sigma2S > 1e-6) ? Math.sqrt(sigma2D / sigma2S) : 1.0;

    // Calculate translation
    const t = muD.clone().sub(muS.clone().applyMatrix3(R).multiplyScalar(s));

    return { s, R, t };
};

/**
 * Remaps a landmark's (x,y) coordinates from a source aspect ratio (e.g., video)
 * to a destination aspect ratio (e.g., canvas) assuming 'object-fit: cover' behavior.
 * @param lm The landmark to remap.
 * @param videoAspect The aspect ratio of the source (width / height).
 * @param canvasAspect The aspect ratio of the destination (width / height).
 * @returns A new landmark with corrected (x,y) coordinates.
 */
export const remapLandmark = (lm: Landmark, videoAspect: number, canvasAspect: number): Landmark => {
    let newX = lm.x;
    let newY = lm.y;

    if (videoAspect > canvasAspect) { // Video is wider than canvas, x-axis is cropped
        const visibleWidthRatio = canvasAspect / videoAspect;
        const xOffset = (1 - visibleWidthRatio) / 2;
        newX = (lm.x - xOffset) / visibleWidthRatio;
    } else { // Video is narrower than canvas, y-axis is cropped
        const visibleHeightRatio = videoAspect / canvasAspect;
        const yOffset = (1 - visibleHeightRatio) / 2;
        newY = (lm.y - yOffset) / visibleHeightRatio;
    }
    
    return { ...lm, x: newX, y: newY };
};