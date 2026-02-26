import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

// ---- Kalman filter for smooth 3D bone/joint positions ----
/** 1D Kalman filter (position + velocity state for smooth prediction). */
class Kalman1D {
  private x: number;
  private v: number;
  private Pxx: number;
  private Pxv: number;
  private Pvv: number;
  private readonly Qp: number; // process noise (position)
  private readonly Qv: number; // process noise (velocity)
  private readonly R: number;  // measurement noise
  private first = true;

  constructor(processNoise = 0.01, measurementNoise = 0.1) {
    this.Qp = processNoise;
    this.Qv = processNoise * 0.1;
    this.R = measurementNoise;
    this.x = 0;
    this.v = 0;
    this.Pxx = 1;
    this.Pxv = 0;
    this.Pvv = 1;
  }

  filter(z: number, dt: number): number {
    if (this.first) {
      this.x = z;
      this.first = false;
      return z;
    }
    dt = Math.min(dt, 0.1);
    // Predict: x = x + v*dt, v = v; P = F*P*F' + Q
    const x_pred = this.x + this.v * dt;
    const v_pred = this.v;
    this.Pxx += dt * dt * this.Pvv + 2 * dt * this.Pxv + this.Qp;
    this.Pxv += dt * this.Pvv;
    this.Pvv += this.Qv;
    // Update (measure position only): H = [1,0], K = P*H'/(H*P*H'+R)
    const S = this.Pxx + this.R;
    const Kx = this.Pxx / S;
    const Kv = this.Pxv / S;
    const y = z - x_pred;
    this.x = x_pred + Kx * y;
    this.v = v_pred + Kv * y;
    this.Pxx = (1 - Kx) * this.Pxx;
    this.Pxv = (1 - Kx) * this.Pxv;
    this.Pvv = this.Pvv - Kv * this.Pxv;
    return this.x;
  }

  reset() {
    this.first = true;
  }
}

/** 3D Kalman filter for Vector3 smoothing (independent x,y,z). */
class KalmanVec3 {
  private kx: Kalman1D;
  private ky: Kalman1D;
  private kz: Kalman1D;
  private lastT = 0;

  constructor(processNoise = 0.01, measurementNoise = 0.08) {
    this.kx = new Kalman1D(processNoise, measurementNoise);
    this.ky = new Kalman1D(processNoise, measurementNoise);
    this.kz = new Kalman1D(processNoise, measurementNoise);
  }

  filter(v: THREE.Vector3): THREE.Vector3 {
    const t = performance.now() / 1000;
    const dt = this.lastT > 0 ? Math.min(t - this.lastT, 0.1) : 0.016;
    this.lastT = t;
    return new THREE.Vector3(
      this.kx.filter(v.x, dt),
      this.ky.filter(v.y, dt),
      this.kz.filter(v.z, dt)
    );
  }

  reset() {
    this.lastT = 0;
    this.kx.reset();
    this.ky.reset();
    this.kz.reset();
  }
}

// --- Types/hooks from your app (keep the same import paths you already use) ---
// If these paths differ in your project, adjust them accordingly.
import { PoseLandmarks, UserRestPose, Landmark } from "../types";
import { useThreeCore } from "./useThreeCore";
import { useAvatar } from "./useAvatar";
import { getBone, applyPoleConstraint, calculatePolePosition } from "./threeUtils";
import { FormationType } from "./DanceArenaControls";
import { useAvatarTracking } from "./useAvatarTracking";

// Mediapipe landmark indices we use here
const L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14, L_WR = 15, R_WR = 16;
const L_HIP = 23, R_HIP = 24, L_KNEE = 25, R_KNEE = 26, L_ANK = 27, R_ANK = 28, L_HEEL = 29, R_HEEL = 30, L_TOE = 31, R_TOE = 32;

const LR = <T,>(flip: boolean, left: T, right: T) => (flip ? right : left);

interface MultiAvatarSceneProps {
  landmarks: PoseLandmarks | null;
  worldLandmarks: PoseLandmarks | null;
  onModelLoad: () => void;
  isFlipped: boolean; // input video mirrored horizontally
  userRestPose: UserRestPose | null;
  videoElement?: HTMLVideoElement | null;
  hdriUrl?: string;
  avatarUrl?: string;
  numAvatars: number;
  formation: FormationType;
  spacing: number;
}

export const MultiAvatarScene = forwardRef<
  { canvas: HTMLCanvasElement | null; renderer?: THREE.WebGLRenderer; scene?: THREE.Scene; camera?: THREE.Camera; },
  MultiAvatarSceneProps
>(
  (
    { landmarks, worldLandmarks, onModelLoad, isFlipped, userRestPose, videoElement, hdriUrl, avatarUrl, numAvatars, formation, spacing },
    ref
  ) => {
    // Core three setup (your hook creates scene/renderer/camera/HDR etc.)
    const mountRef = useRef<HTMLDivElement>(null);
    const threeCore = useThreeCore({ mountRef, hdriUrl, transparent: false, cameraType: "perspective" });

    const { driverModel: masterAvatar, isAvatarLoaded, initialBoneData, modelTorsoHeight, rigRestPoints } =
      useAvatar(threeCore?.scene || null, undefined, avatarUrl);

    // Debug toggles/knobs (UI below)
    const [mirrorMode, setMirrorMode] = useState<"swap" | "negateX">("swap");
    const [applyRootRot, setApplyRootRot] = useState(false); // hips/spine orientation
    const [applyWorldTranslate, setApplyWorldTranslate] = useState(true); // move wrapper in world
    const [applyArms, setApplyArms] = useState(true);
    const [applyLegs, setApplyLegs] = useState(true);
    const [handYFlip, setHandYFlip] = useState(false);
    const [shoulderAbsDot, setShoulderAbsDot] = useState(true);
    const [kneeAbsDot, setKneeAbsDot] = useState(true);
    const [spineRollDamp, setSpineRollDamp] = useState(0.25);
    const [hipPreRotateXDeg, setHipPreRotateXDeg] = useState(0);
    const [depthScale, setDepthScale] = useState(1.0);

    // world translation tuning
    const [pelvisGain, setPelvisGain] = useState(0.008); // pixels->world gain
    const [pelvisYOffset, setPelvisYOffset] = useState(0.0);
    const [lockYToGround, setLockYToGround] = useState(true);

    // Kalman filters for smooth bone/joint positions (wrists, ankles, pole vectors, pelvis)
    const wristLFilter = useRef(new KalmanVec3(0.008, 0.06));
    const wristRFilter = useRef(new KalmanVec3(0.008, 0.06));
    const ankleLFilter = useRef(new KalmanVec3(0.008, 0.06));
    const ankleRFilter = useRef(new KalmanVec3(0.008, 0.06));

    const elbowLFilter = useRef(new KalmanVec3(0.005, 0.08));
    const elbowRFilter = useRef(new KalmanVec3(0.005, 0.08));
    const kneeLFilter = useRef(new KalmanVec3(0.005, 0.08));
    const kneeRFilter = useRef(new KalmanVec3(0.005, 0.08));

    const pelvisFilter = useRef(new KalmanVec3(0.01, 0.07));

    // Arena & clones
    const arenaRef = useRef<THREE.Group>(new THREE.Group());
    const wrapperRefs = useRef<THREE.Group[]>([]);
    const clonesRef = useRef<THREE.Group[]>([]);

    useImperativeHandle(
      ref,
      () => ({ canvas: threeCore?.renderer?.domElement || null, renderer: threeCore?.renderer, scene: threeCore?.scene, camera: threeCore?.camera }),
      [threeCore]
    );

    // Camera / arena yaw tracker (from your existing hook)
    useAvatarTracking({
      landmarks,
      worldLandmarks,
      userRestPose,
      modelTorsoHeight,
      rigRestPoints,
      isFlipped,
      renderer: threeCore?.renderer,
      camera: threeCore?.camera,
    });

    // Add arena once
    useEffect(() => {
      if (!threeCore?.scene) return;
      threeCore.scene.add(arenaRef.current);
      arenaRef.current.position.set(0, 0, 0);
      return () => void threeCore.scene.remove(arenaRef.current);
    }, [threeCore]);

    // Spawn avatar clones
    useEffect(() => {
      const scene = threeCore?.scene;
      if (!scene || !isAvatarLoaded || !masterAvatar) return;

      // clear
      wrapperRefs.current.forEach((w) => arenaRef.current.remove(w));
      wrapperRefs.current = [];
      clonesRef.current = [];

      for (let i = 0; i < numAvatars; i++) {
        const clone = skeletonClone(masterAvatar) as THREE.Group;
        clone.scale.setScalar(1);
        const wrapper = new THREE.Group();
        wrapper.add(clone);

        const pos = new THREE.Vector3();
        switch (formation) {
          case "line": pos.x = (i - (numAvatars - 1) / 2) * spacing; break;
          case "v-shape": {
            const side = i % 2 === 0 ? -1 : 1; const rank = Math.floor((i + 1) / 2);
            pos.x = side * rank * spacing; pos.z = -rank * spacing; if (numAvatars % 2 !== 0 && i === numAvatars - 1) pos.x = 0; break;
          }
          case "circle": {
            const angle = (i / numAvatars) * Math.PI * 2; const radius = spacing * Math.max(1, numAvatars / Math.PI / 1.5);
            pos.x = Math.sin(angle) * radius; pos.z = Math.cos(angle) * radius; wrapper.lookAt(0, 0, 0); break;
          }
          case "grid": {
            const cols = Math.ceil(Math.sqrt(numAvatars)); const row = Math.floor(i / cols); const col = i % cols;
            pos.x = (col - (cols - 1) / 2) * spacing; pos.z = -row * spacing; break;
          }
        }
        wrapper.position.copy(pos);
        (wrapper as any).userData = { basePos: pos.clone() };
        arenaRef.current.add(wrapper);
        wrapperRefs.current.push(wrapper);
        clonesRef.current.push(clone);
      }
      // reset pelvis Kalman filter whenever we respawn
      pelvisFilter.current = new KalmanVec3(0.01, 0.07);
    }, [numAvatars, formation, spacing, isAvatarLoaded, masterAvatar, threeCore]);

    useEffect(() => { if (isAvatarLoaded) onModelLoad(); }, [isAvatarLoaded, onModelLoad]);

    // --- Controls (orbit) ---
    useEffect(() => {
      if (!threeCore?.camera || !threeCore.renderer) return;
      const controls = new OrbitControls(threeCore.camera as THREE.PerspectiveCamera, threeCore.renderer.domElement);
      controls.enableDamping = true; controls.target.set(0, 1, 0);
      const tick = () => { controls.update(); requestAnimationFrame(tick); };
      tick();
      return () => controls.dispose();
    }, [threeCore?.camera, threeCore?.renderer]);

    // ---- helpers -------------------------------------------------------------
    function toWorld(p: Landmark, width: number, height: number) {
      const negateX = mirrorMode === "negateX" && isFlipped ? -1 : 1;
      const x = (p.x - 0.5) * width * negateX;
      const y = -(p.y - 0.5) * height;
      let z = -(p.z ?? 0) * width * depthScale;
      if (handYFlip) z = -z; // optional Y/Z flip compensator
      return new THREE.Vector3(x, y, z);
    }
    function mpToWorld(mp: { x: number; y: number; z?: number }) { return new THREE.Vector3(mp.x, -mp.y, -(mp.z ?? 0)); }
    const midpoint = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().add(b).multiplyScalar(0.5);

    function quatFromTwoVecs(start: THREE.Vector3, end: THREE.Vector3, absDot = false) {
      const a = start.clone().normalize(); const b = end.clone().normalize();
      let dot = a.dot(b); if (absDot) dot = Math.abs(dot);
      if (dot < -0.999) {
        let axis = new THREE.Vector3(0, 0, 1).cross(a); if (axis.lengthSq() < 1e-4) axis = new THREE.Vector3(1, 0, 0).cross(a);
        axis.normalize(); return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
      }
      const axis = new THREE.Vector3().crossVectors(a, b); const s = Math.sqrt((1 + dot) * 2); const invs = 1 / s;
      return new THREE.Quaternion(axis.x * invs, axis.y * invs, axis.z * invs, s * 0.5).normalize();
    }

    function hipsQuatFromTriangle(leftUpLeg: THREE.Vector3, rightUpLeg: THREE.Vector3, spine: THREE.Vector3) {
      // Use hip center for symmetric "Up" vector calculation
      const hipCenter = new THREE.Vector3().addVectors(leftUpLeg, rightUpLeg).multiplyScalar(0.5);
      const upParam = new THREE.Vector3().subVectors(spine, hipCenter).normalize();
      const rightParam = new THREE.Vector3().subVectors(rightUpLeg, leftUpLeg).normalize();

      // Guard against degenerate vectors (all points at same location)
      if (upParam.lengthSq() < 1e-4 || rightParam.lengthSq() < 1e-4) {
        return new THREE.Quaternion(); // Identity fallback
      }

      // Calculate Forward (Using Right x Up)
      const forwardNormal = new THREE.Vector3().crossVectors(rightParam, upParam).normalize();

      // Guard against parallel vectors
      if (forwardNormal.lengthSq() < 1e-4) {
        return new THREE.Quaternion();
      }

      // Recalculate true Up vector to ensure orthogonality
      const correctedUp = new THREE.Vector3().crossVectors(forwardNormal, rightParam).normalize();

      // Standard T-pose basis: X=Right, Y=Up, Z=Forward
      const m = new THREE.Matrix4().makeBasis(rightParam, correctedUp, forwardNormal);
      const q = new THREE.Quaternion().setFromRotationMatrix(m).normalize();

      // NaN Guard
      if (isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || isNaN(q.w)) {
        return new THREE.Quaternion();
      }
      return q;
    }

    function dampSpineRollToZero(bone: THREE.Bone, strength = 0.25) {
      bone.quaternion.slerp(new THREE.Quaternion(), THREE.MathUtils.clamp(strength, 0, 1));
    }

    function aimBoneTo(bone: THREE.Bone, parent: THREE.Object3D, targetDirWorld: THREE.Vector3, slerpT = 0.6, absDot = false) {
      // Current bone direction in WORLD (from bone to its first child or a probe)
      const bonePos = new THREE.Vector3(); bone.getWorldPosition(bonePos);
      const childPos = new THREE.Vector3();
      if (bone.children.length && bone.children[0] instanceof THREE.Bone) {
        (bone.children[0] as THREE.Bone).getWorldPosition(childPos);
      } else {
        childPos.copy(bonePos).add(new THREE.Vector3(0, -0.1, 0));
      }
      const modelDirWorld = childPos.clone().sub(bonePos).normalize();

      const rot = quatFromTwoVecs(modelDirWorld, targetDirWorld, absDot);
      const boneWorldQ = new THREE.Quaternion(); bone.getWorldQuaternion(boneWorldQ);
      const parentWorldQ = new THREE.Quaternion(); parent.getWorldQuaternion(parentWorldQ);
      const worldTargetQ = rot.multiply(boneWorldQ);
      const localTargetQ = parentWorldQ.clone().invert().multiply(worldTargetQ);
      bone.quaternion.slerp(localTargetQ, slerpT);
    }

    function applyRootFK(clone: THREE.Group, lm: PoseLandmarks, width: number, height: number) {
      const lHipW = toWorld(lm[L_HIP], width, height);
      const rHipW = toWorld(lm[R_HIP], width, height);
      const lShW = toWorld(lm[L_SH], width, height);
      const rShW = toWorld(lm[R_SH], width, height);
      const spineMid = midpoint(lShW, rShW);
      const q = hipsQuatFromTriangle(lHipW, rHipW, spineMid);

      const hips = getBone(clone, "Hips");
      if (hips && initialBoneData.has(hips.name)) {
        const base = initialBoneData.get(hips.name)!.quaternion.clone();
        const pre = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(hipPreRotateXDeg), 0, 0));
        const target = pre.multiply(q);
        (hips as THREE.Bone).quaternion.copy(base).slerp(target, 0.6);
        (hips as THREE.Bone).position.y = initialBoneData.get(hips.name)!.position.y;
      }

      const spine1 = getBone(clone, "Spine");
      const spine2 = getBone(clone, "Spine1") || getBone(clone, "Spine2");
      const neck = getBone(clone, "Neck");
      if (spineRollDamp > 0) {
        if (spine1) dampSpineRollToZero(spine1 as THREE.Bone, spineRollDamp);
        if (spine2) dampSpineRollToZero(spine2 as THREE.Bone, spineRollDamp * 0.6);
        if (neck) dampSpineRollToZero(neck as THREE.Bone, spineRollDamp * 0.4);
      }
    }

    function applyArmFK(
      clone: THREE.Group,
      lm: PoseLandmarks,
      width: number,
      height: number,
      side: "Left" | "Right",
      swapLR: boolean,
      hasWorld: boolean
    ) {
      const map = side === "Left"
        ? { S: LR(swapLR, L_SH, R_SH), E: LR(swapLR, L_EL, R_EL), W: LR(swapLR, L_WR, R_WR) }
        : { S: LR(swapLR, R_SH, L_SH), E: LR(swapLR, R_EL, L_EL), W: LR(swapLR, R_WR, L_WR) };

      // Use World Landmarks for consistent 3D rotational math if available
      const S = hasWorld ? mpToWorld({ x: lm[map.S].x, y: lm[map.S].y, z: lm[map.S].z ?? 0 }) : toWorld(lm[map.S], width, height);
      const E = hasWorld ? mpToWorld({ x: lm[map.E].x, y: lm[map.E].y, z: lm[map.E].z ?? 0 }) : toWorld(lm[map.E], width, height);
      const Wraw = hasWorld ? mpToWorld({ x: lm[map.W].x, y: lm[map.W].y, z: lm[map.W].z ?? 0 }) : toWorld(lm[map.W], width, height);

      // light filtering on wrists for stability
      const W = side === "Left" ? wristLFilter.current.filter(Wraw) : wristRFilter.current.filter(Wraw);

      const upper = new THREE.Vector3().subVectors(E, S).normalize();
      const lower = new THREE.Vector3().subVectors(W, E).normalize();

      // Calculate derived pole target for twist correction (elbow pointing direction)
      // The elbow typically points away from the body/plane of bend
      let impliedPole = calculatePolePosition(S, E, W, 100);

      // Filter the pole vector to smooth out twist jitter
      impliedPole = side === "Left" ? elbowLFilter.current.filter(impliedPole) : elbowRFilter.current.filter(impliedPole);

      if (handYFlip) { upper.y *= -1; lower.y *= -1; impliedPole.y *= -1; }

      const upperBoneName = `${side}Arm`;
      const lowerBoneName = `${side}ForeArm`;
      const upperBone = getBone(clone, upperBoneName) || getBone(clone, `${side}UpperArm`);
      const lowerBone = getBone(clone, lowerBoneName) || getBone(clone, `${side}LowerArm`);
      const handBone = getBone(clone, `${side}Hand`);

      // 1. Aim the bones (Direction)
      if (upperBone && upper.lengthSq() > 1e-4) {
        const parent = (upperBone.parent as THREE.Object3D) || clone;
        aimBoneTo(upperBone as THREE.Bone, parent, upper, 0.55, shoulderAbsDot);
      }
      if (lowerBone && lower.lengthSq() > 1e-4) {
        const parent = (lowerBone.parent as THREE.Object3D) || clone;
        aimBoneTo(lowerBone as THREE.Bone, parent, lower, 0.65, false);
      }

      // 2. Apply Twist Correction (Pole Constraint)
      // Check for NaNs to prevent model disappearing
      if (upperBone && lowerBone && impliedPole && !isNaN(impliedPole.x)) {
        // Create a temporary bone object to represent the pole target in world space
        // This is a bit of a hack to use the existing function signature, but efficient
        const tempPoleBone = new THREE.Bone();
        tempPoleBone.position.copy(impliedPole);
        tempPoleBone.updateMatrixWorld(true); // Ensure world matrix is ready

        applyPoleConstraint({
          upperBoneName: upperBone.name,
          lowerBoneName: lowerBone.name,
          poleTargetBone: tempPoleBone, // Pass our virtual pole bone
          driverModel: clone
        });
      }

      // Make the hand roughly face wrist motion direction
      if (handBone) {
        const parent = (handBone.parent as THREE.Object3D) || clone;
        const handDir = lower.clone();
        aimBoneTo(handBone as THREE.Bone, parent, handDir, 0.5, false);
      }
    }

    function applyLegFK(
      clone: THREE.Group,
      lm: PoseLandmarks,
      width: number,
      height: number,
      side: "Left" | "Right",
      swapLR: boolean,
      hasWorld: boolean
    ) {
      const map = side === "Left"
        ? { H: LR(swapLR, L_HIP, R_HIP), K: LR(swapLR, L_KNEE, R_KNEE), A: LR(swapLR, L_ANK, R_ANK), T: LR(swapLR, L_TOE, R_TOE), HE: LR(swapLR, L_HEEL, R_HEEL) }
        : { H: LR(swapLR, R_HIP, L_HIP), K: LR(swapLR, R_KNEE, L_KNEE), A: LR(swapLR, R_ANK, L_ANK), T: LR(swapLR, R_TOE, L_TOE), HE: LR(swapLR, R_HEEL, L_HEEL) };

      const H = hasWorld ? mpToWorld({ x: lm[map.H].x, y: lm[map.H].y, z: lm[map.H].z ?? 0 }) : toWorld(lm[map.H], width, height);
      const K = hasWorld ? mpToWorld({ x: lm[map.K].x, y: lm[map.K].y, z: lm[map.K].z ?? 0 }) : toWorld(lm[map.K], width, height);
      const Araw = hasWorld ? mpToWorld({ x: lm[map.A].x, y: lm[map.A].y, z: lm[map.A].z ?? 0 }) : toWorld(lm[map.A], width, height);
      const Toe = lm[map.T] ? (hasWorld ? mpToWorld({ x: lm[map.T].x, y: lm[map.T].y, z: lm[map.T].z ?? 0 }) : toWorld(lm[map.T], width, height)) : null;
      const Heel = lm[map.HE] ? (hasWorld ? mpToWorld({ x: lm[map.HE].x, y: lm[map.HE].y, z: lm[map.HE].z ?? 0 }) : toWorld(lm[map.HE], width, height)) : null;

      const A = side === "Left" ? ankleLFilter.current.filter(Araw) : ankleRFilter.current.filter(Araw);

      const upper = new THREE.Vector3().subVectors(K, H).normalize(); // thigh dir
      const lower = new THREE.Vector3().subVectors(A, K).normalize(); // shin dir

      // Calculate implied pole (kneecap direction)
      let impliedPole = calculatePolePosition(H, K, A, 100);

      // Filter pole vector
      impliedPole = side === "Left" ? kneeLFilter.current.filter(impliedPole) : kneeRFilter.current.filter(impliedPole);

      const footDir = Toe && Heel ? new THREE.Vector3().subVectors(Toe, Heel).normalize() : lower.clone();

      const thighBone = getBone(clone, `${side}UpLeg`) || getBone(clone, `${side}UpperLeg`) || getBone(clone, `${side}Thigh`);
      const shinBone = getBone(clone, `${side}Leg`) || getBone(clone, `${side}LowerLeg`) || getBone(clone, `${side}Calf`);
      const footBone = getBone(clone, `${side}Foot`);
      const toeBone = getBone(clone, `${side}ToeBase`) || getBone(clone, `${side}Toe`) || getBone(clone, `${side}Toes`);

      // 1. Aim Bones
      if (thighBone && upper.lengthSq() > 1e-4) {
        const parent = (thighBone.parent as THREE.Object3D) || clone;
        aimBoneTo(thighBone as THREE.Bone, parent, upper, 0.55, kneeAbsDot);
      }
      if (shinBone && lower.lengthSq() > 1e-4) {
        const parent = (shinBone.parent as THREE.Object3D) || clone;
        aimBoneTo(shinBone as THREE.Bone, parent, lower, 0.7, false);
      }

      // 2. Apply Twist Correction (Pole Constraint)
      if (thighBone && shinBone && impliedPole && !isNaN(impliedPole.x)) {
        const tempPoleBone = new THREE.Bone();
        tempPoleBone.position.copy(impliedPole);
        tempPoleBone.updateMatrixWorld(true);

        applyPoleConstraint({
          upperBoneName: thighBone.name,
          lowerBoneName: shinBone.name,
          poleTargetBone: tempPoleBone,
          driverModel: clone
        });
      }

      // Foot tries to align heel->toe direction; fallback to shin direction
      if (footBone) {
        const parent = (footBone.parent as THREE.Object3D) || clone;
        const dir = footDir.clone();
        aimBoneTo(footBone as THREE.Bone, parent, dir, 0.6, false);
      }
      if (toeBone && Toe && Heel) {
        const parent = (toeBone.parent as THREE.Object3D) || clone;
        const dir = footDir.clone();
        aimBoneTo(toeBone as THREE.Bone, parent, dir, 0.6, false);
      }
    }

    function computePelvisWorld(lm: PoseLandmarks, width: number, height: number) {
      const lHipW = toWorld(lm[L_HIP], width, height);
      const rHipW = toWorld(lm[R_HIP], width, height);
      return midpoint(lHipW, rHipW);
    }

    // ---- animate -------------------------------------------------------------
    useEffect(() => {
      if (!threeCore?.renderer || !threeCore.scene || !threeCore.camera) return;
      const renderer = threeCore.renderer; const scene = threeCore.scene; const camera = threeCore.camera as THREE.PerspectiveCamera;

      let raf = 0;
      const render = () => {
        const lm = worldLandmarks || landmarks; // prefer world if provided
        const hasWorld = !!worldLandmarks;
        const vidW = videoElement?.videoWidth || 640;
        const vidH = videoElement?.videoHeight || 360;

        if (lm && clonesRef.current.length) {
          // Shared world translation from pelvis midpoint (applied to wrappers)
          if (applyWorldTranslate && wrapperRefs.current.length) {
            let pelvis = computePelvisWorld(lm, vidW, vidH);
            pelvis = pelvisFilter.current.filter(pelvis);
            // scale to world & optional ground lock
            const worldOffset = new THREE.Vector3(pelvis.x * pelvisGain, (lockYToGround ? 0 : pelvis.y * pelvisGain) + pelvisYOffset, pelvis.z * pelvisGain);
            for (let i = 0; i < wrapperRefs.current.length; i++) {
              const w = wrapperRefs.current[i];
              const base = (w as any).userData?.basePos as THREE.Vector3 | undefined;
              if (base) {
                w.position.set(base.x + worldOffset.x, base.y + worldOffset.y, base.z + worldOffset.z);
              }
            }
          }

          for (const clone of clonesRef.current) {
            if (applyRootRot) applyRootFK(clone, lm, vidW, vidH); // only orientation
            const swapLR = mirrorMode === "swap" && isFlipped;
            if (applyArms) {
              applyArmFK(clone, lm, vidW, vidH, "Left", swapLR, hasWorld);
              applyArmFK(clone, lm, vidW, vidH, "Right", swapLR, hasWorld);
            }
            if (applyLegs) {
              applyLegFK(clone, lm, vidW, vidH, "Left", swapLR, hasWorld);
              applyLegFK(clone, lm, vidW, vidH, "Right", swapLR, hasWorld);
            }
          }
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);
      return () => cancelAnimationFrame(raf);
    }, [threeCore?.renderer, threeCore?.scene, threeCore?.camera, landmarks, worldLandmarks, isFlipped, applyRootRot, applyArms, applyLegs, handYFlip, shoulderAbsDot, kneeAbsDot, spineRollDamp, hipPreRotateXDeg, depthScale, mirrorMode, videoElement, applyWorldTranslate, pelvisGain, pelvisYOffset, lockYToGround]);

    // ---- UI: just the canvas mount (no debug overlay) ----
    return (
      <div ref={mountRef} style={{ position: "relative", width: "100%", height: "100%" }} />
    );
  }
);
