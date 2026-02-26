import * as THREE from 'three';
import { Landmark } from '../types';

// Moved from poseRetargeting.ts to be shared without circular dependencies.
export const getBone = (root: THREE.Object3D, boneName: string): THREE.Bone | null => {
    const nameVariations = [
        `mixamorig${boneName}`,
        `mixamorig:${boneName}`,
        boneName
    ];

    for (const name of nameVariations) {
        const bone = root.getObjectByName(name);
        if (bone && bone.type === 'Bone') {
            return bone as THREE.Bone;
        }
    }
    // A special check for the main hip bone, which might not have a prefix.
    if (boneName === 'Hips') {
        const bone = root.getObjectByName('Hips');
        if (bone && bone.type === 'Bone') {
            return bone as THREE.Bone;
        }
    }
    return null;
};


export function screenToNDC(clientX: number, clientY: number, dom: HTMLElement) {
    const rect = dom.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return new THREE.Vector2(x, y);
}

export function intersectGroundFromNDC(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
    raycaster: THREE.Raycaster,
    plane: THREE.Plane
) {
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    const ok = raycaster.ray.intersectPlane(plane, hit);
    return ok ? hit : null;
}

export function landmarkToGroundPoint(
    lm: Landmark,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    isFlipped: boolean,
    raycaster: THREE.Raycaster,
    plane: THREE.Plane
) {
    if (!renderer || !camera || !raycaster || !plane) return null;
    const { clientWidth: width, clientHeight: height } = renderer.domElement;
    const flipX = isFlipped ? (1 - lm.x) : lm.x;
    const clientX = flipX * width;
    const clientY = lm.y * height;
    const ndc = screenToNDC(clientX, clientY, renderer.domElement);
    return intersectGroundFromNDC(ndc, camera, raycaster, plane);
}

/**
 * Calculates a robust pole target position based on the current geometry of a 3-bone limb.
 * This prevents the limb from bending in unnatural directions, especially from a straight pose.
 * @param driverModel The root of the model containing the skeleton.
 * @param ikPoleTargets A map of all pole target bones in the scene.
 * @param poleKey The key for the specific pole target bone to position.
 * @param upperJointName The name of the top bone in the chain (e.g., 'LeftUpLeg').
 * @param midJointName The name of the middle bone (the joint that bends, e.g., 'LeftLeg').
 * @param effectorJointName The name of the end effector bone (e.g., 'LeftFoot').
 * @param isArm A boolean hint to determine the correct fallback pole direction.
 * @param offset An optional vector to apply as a manual offset to the calculated position.
 */
export function setPoleTargetRobust(
    driverModel: THREE.Object3D,
    ikPoleTargets: { [key: string]: THREE.Bone },
    poleKey: string,
    upperJointName: string,
    midJointName: string,
    effectorJointName: string,
    isArm: boolean,
    offset?: THREE.Vector3
) {
    const poleTarget = ikPoleTargets[poleKey];
    if (!poleTarget || !poleTarget.parent) return;

    const upperJoint = getBone(driverModel, upperJointName);
    const midJoint = getBone(driverModel, midJointName);
    const effectorJoint = getBone(driverModel, effectorJointName);

    if (!upperJoint || !midJoint || !effectorJoint) return;

    const upperPos = new THREE.Vector3();
    const midPos = new THREE.Vector3();
    const effectorPos = new THREE.Vector3();

    upperJoint.getWorldPosition(upperPos);
    midJoint.getWorldPosition(midPos);
    effectorJoint.getWorldPosition(effectorPos);

    const limbAxis = new THREE.Vector3().subVectors(effectorPos, upperPos);
    const projectedMidPoint = upperPos.clone().add(
        limbAxis.multiplyScalar(
            (midPos.clone().sub(upperPos)).dot(limbAxis) / limbAxis.lengthSq()
        )
    );

    const poleDirection = new THREE.Vector3().subVectors(midPos, projectedMidPoint);

    if (poleDirection.lengthSq() < 1e-8) {
        const fallbackDir = new THREE.Vector3(0, 0, isArm ? -1 : 1);

        const upperJointParent = upperJoint.parent;
        if (upperJointParent) {
            const parentWorldQuat = new THREE.Quaternion();
            upperJointParent.getWorldQuaternion(parentWorldQuat);
            fallbackDir.applyQuaternion(parentWorldQuat);
        } else {
            const modelQuat = new THREE.Quaternion();
            (driverModel as THREE.Object3D).getWorldQuaternion(modelQuat);
            fallbackDir.applyQuaternion(modelQuat);
        }
        poleDirection.copy(fallbackDir);
    }

    poleDirection.normalize();
    const poleDistance = 300;
    const poleWorldPosition = midPos.clone().add(poleDirection.multiplyScalar(poleDistance));

    if (offset) {
        poleWorldPosition.add(offset);
    }

    const poleLocalPosition = poleTarget.parent.worldToLocal(poleWorldPosition);
    poleTarget.position.copy(poleLocalPosition);
}

export function applyPoleConstraint({
    upperBoneName, lowerBoneName, poleTargetBone, driverModel
}: { upperBoneName: string; lowerBoneName: string; poleTargetBone: THREE.Bone | null | undefined; driverModel: THREE.Object3D; }) {
    if (!poleTargetBone) return;
    const upper = getBone(driverModel, upperBoneName);
    const lower = getBone(driverModel, lowerBoneName);
    if (!upper || !lower || !upper.parent) return;

    // Get world positions
    const pUpper = new THREE.Vector3(); upper.getWorldPosition(pUpper);
    const pLower = new THREE.Vector3(); lower.getWorldPosition(pLower);
    const pPole = new THREE.Vector3(); poleTargetBone.getWorldPosition(pPole);

    // The axis of the upper limb, which we will twist around
    const limbAxis = new THREE.Vector3().subVectors(pLower, pUpper).normalize();
    if (limbAxis.lengthSq() < 1e-8) return; // Avoid issues if bones are at the same position

    // Get the bone's current orientation in world space
    const upperWorldQ = new THREE.Quaternion();
    upper.getWorldQuaternion(upperWorldQ);

    // Define a stable reference vector in the bone's local space.
    // For a T-posed Mixamo rig, the local X-axis typically points "out" to the side.
    const localRefVec = new THREE.Vector3(1, 0, 0);

    // The "current" direction the side of the arm is pointing, in world space.
    const currentSideDir = localRefVec.clone().applyQuaternion(upperWorldQ);

    // The "desired" direction for the side of the arm to point is towards the pole target.
    const desiredSideDir = new THREE.Vector3().subVectors(pPole, pLower);

    // Project these side vectors onto the plane perpendicular to the limb's axis.
    // This isolates the "twist" component of the rotation.
    const projectedCurrent = currentSideDir.projectOnPlane(limbAxis).normalize();
    const projectedDesired = desiredSideDir.projectOnPlane(limbAxis).normalize();

    // If the projections are valid, calculate the corrective rotation.
    if (projectedCurrent.lengthSq() < 1e-8 || projectedDesired.lengthSq() < 1e-8) return;

    // This quaternion represents the shortest rotation to align the twist.
    const rotationDelta = new THREE.Quaternion().setFromUnitVectors(projectedCurrent, projectedDesired);

    // Apply the delta to the current world rotation to get our target.
    const targetWorldQ = rotationDelta.multiply(upperWorldQ);

    // Convert the target world rotation back into the local space of the bone's parent.
    const parentWorldQ = new THREE.Quaternion();
    upper.parent.getWorldQuaternion(parentWorldQ);
    const targetLocalQ = parentWorldQ.clone().invert().multiply(targetWorldQ);

    // Smoothly interpolate to the target for natural, non-jittery motion.
    upper.quaternion.slerp(targetLocalQ, 0.6);
}


export function preBend(driverModel: THREE.Object3D, boneName: string, radians: number) {
    const b = getBone(driverModel, boneName); if (!b) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians);
    b.quaternion.multiply(q);
}

export function stickFootToGround(driverModel: THREE.Object3D, footName: string, groundPlane: THREE.Plane) {
    const foot = getBone(driverModel, footName);
    if (!foot || !foot.parent) return;

    const p = new THREE.Vector3();
    foot.getWorldPosition(p);

    const distance = groundPlane.distanceToPoint(p);
    if (distance < 0) { // point is "below" the plane
        const projectedPoint = new THREE.Vector3();
        groundPlane.projectPoint(p, projectedPoint);

        const local = foot.parent.worldToLocal(projectedPoint);
        foot.position.lerp(local, 0.5);
    }
}

/**
 * Calculates a pole target position for a 3-joint chain (Start -> Mid -> End).
 * The pole target is placed along the normal of the triangle formed by the three joints,
 * which defines the plane of the limb bend.
 */
export function calculatePolePosition(
    start: THREE.Vector3,
    mid: THREE.Vector3,
    end: THREE.Vector3,
    length: number = 50
): THREE.Vector3 {
    // Guard against invalid inputs
    if (!start || !mid || !end || isNaN(start.x) || isNaN(mid.x) || isNaN(end.x)) {
        return mid ? mid.clone().add(new THREE.Vector3(0, 0, length)) : new THREE.Vector3(0, 0, length);
    }

    const limbAxis = new THREE.Vector3().subVectors(end, start);
    const axisSq = limbAxis.lengthSq();

    // Guard against zero-length limb (start == end)
    if (axisSq < 1e-6) {
        return mid.clone().add(new THREE.Vector3(0, 0, length));
    }

    const midToStart = new THREE.Vector3().subVectors(mid, start);

    // Project mid point onto limb axis
    const t = midToStart.dot(limbAxis) / axisSq;
    const projectedMid = start.clone().add(limbAxis.multiplyScalar(t));

    // The bend direction is from the projected point to the actual mid point
    const bendDir = new THREE.Vector3().subVectors(mid, projectedMid).normalize();

    // If the limb is perfectly straight, this will be zero. Handle effectively by defaulting to nothing
    if (bendDir.lengthSq() < 0.0001) {
        return mid.clone().add(new THREE.Vector3(0, 0, length)); // Fallback
    }

    return mid.clone().add(bendDir.multiplyScalar(length));
}