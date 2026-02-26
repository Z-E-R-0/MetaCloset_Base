import * as THREE from 'three';
import { PoseLandmarkerResult } from '@medipe/tasks-vision';

export type FirebaseUser = { displayName: string | null; email: string | null; photoURL: string | null };

export interface Garment {
  id: string;
  name: string;
  modelUrl: string;
  previewImageUrl: string;
  refImageUrl?: string; // URL for an AI reference image for clothes swapping
  refImagePrompt?: string; // AI-generated description of the ref image
  scale: number;
  xOffset: number; // Horizontal offset for centering
  yOffset: number; // Vertical offset to position correctly on the body
  isRigged?: boolean; // Does the model have a skeleton to be animated?
  category: string;
  gender: 'Male' | 'Female' | 'Unisex';
  yBotUrl?: string; // Custom driver model for this garment
  // New fields for DevPage preview card
  previewScale?: number;
  previewPosition?: { x: number; y: number; z: number };
}

export type AttachmentBone = 'Head' | 'Neck' | 'LeftHand' | 'RightHand';

export interface Accessory {
  id: string;
  name: string;
  modelUrl: string;
  previewImageUrl: string;
  scale: number;
  // The name of the bone on the avatar model to which this accessory should be attached.
  attachmentBone: AttachmentBone;
  // Offset from the attachment bone's origin in local space units.
  positionOffset: { x: number; y: number; z: number }; 
  // Rotation offset from the bone's default orientation, in radians.
  rotationOffset: { x: number; y: number; z: number };
  // If true, the accessory will be duplicated and mirrored. Currently used for earrings.
  isPair?: boolean;
  category: string;
  gender: 'Male' | 'Female' | 'Unisex';
}

// Simplified landmark structure for our use case, based on MediaPipe's NormalizedLandmark
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type PoseLandmarks = Landmark[];
export type { PoseLandmarkerResult };


export interface Adjustments {
  scale: number;
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
  xOffset: number; // fraction of screen width
  yOffset: number; // fraction of screen height
  hipHeightOffset: number; // vertical pixel offset for sitting
}

export interface BoneAdjustment {
  rotation: { x: number; y: number; z: number }; // Euler angles in radians
  isInverted: boolean;
}

export type BoneAdjustments = {
  [boneName: string]: BoneAdjustment;
};

export interface LimbVector {
    start: Landmark;
    end: Landmark;
    direction: THREE.Vector3;
    length: number;
}
  
export interface UserRestPose {
    leftUpperArm: LimbVector;
    leftLowerArm: LimbVector;
    rightUpperArm: LimbVector;
    rightLowerArm: LimbVector;
    leftUpperLeg: LimbVector;
    leftLowerLeg: LimbVector;
    rightUpperLeg: LimbVector;
    rightLowerLeg: LimbVector;
    leftFoot: LimbVector;
    rightFoot: LimbVector;
    torso: LimbVector;
    shoulderToShoulder: LimbVector;
    shoulderWidth2D: number; // Normalized horizontal screen distance between shoulders
    torsoHeight2D: number; // Normalized vertical screen distance between hip center and shoulder center
    torsoDiagonal2D: number; // Normalized 2D diagonal distance from left shoulder to right hip
    // We also store the indices of key landmarks for Umeyama calculation.
    points: { [key: string]: number };
}

export interface SegmentationData {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

// Represents a segmentation mask with its data copied to a stable buffer.
export interface SimpleMask {
  buffer: Uint8Array;
  width: number;
  height: number;
}

export interface IKRotationOverrides {
  leftShoulder: { x: number; y: number; z: number };
  rightShoulder: { x: number; y: number; z: number };
  leftHip: { x: number; y: number; z: number };
  rightHip: { x: number; y: number; z: number };
  hips: { x: number; y: number; z: number };
  spine: { x: number; y: number; z: number };
  spine1: { x: number; y: number; z: number };
  spine2: { x: number; y: number; z: number };
}

export interface IKPoleVectorOffsets {
  leftElbow: { x: number; y: number; z: number };
  rightElbow: { x: number; y: number; z: number };
  leftKnee: { x: number; y: number; z: number };
  rightKnee: { x: number; y: number; z: number };
}

export interface ManualIKState {
  isEnabled: boolean;
  targets: {
    hip: { x: number; y: number; z: number };
    leftHand: { x: number; y: number; z: number };
    rightHand: { x: number; y: number; z: number };
    leftFoot: { x: number; y: number; z: number };
    rightFoot: { x: number; y: number; z: number };
  };
  rotationOverrides: IKRotationOverrides;
  poleVectorOffsets: IKPoleVectorOffsets;
  upperBodyTarget: { x: number; y: number; z: number };
  bendIntensity: number;
}

export interface EditPageData {
  videoFrame: string; // dataURL of the captured video frame
  garmentOverlay: string; // dataURL of the garment overlay
  personMask: SimpleMask; // The segmentation mask for the person
  garment: Garment; // The garment being edited
}

export interface BackgroundImage {
  id:string;
  name: string;
  url: string;
}

export interface BrandAssets {
  logoUrl: string;
  assetUrl1: string; // Formerly soapUrl
  assetUrl2: string; // Formerly flowerUrl
  assetUrl3?: string; // Formerly introImageUrl
  hdriUrl?: string;
  shareOverlayUrl?: string;
  yBotUrl?: string;
}

export interface Animation {
  name: string;
  url: string;
}

export interface Avatar {
  id: string;
  name: string;
  modelUrl: string;
  gender: 'Male' | 'Female' | 'Unisex';
}

export interface AppConfig {
  garments: Garment[];
  accessories: Accessory[];
  backgroundImages: BackgroundImage[];
  brandAssets: BrandAssets;
  animations: Animation[];
  avatars: Avatar[];
  defaultIKPose?: ManualIKState;
}

export interface SimilarityTransform {
    s: number; // scale
    R: THREE.Matrix3; // rotation
    t: THREE.Vector3; // translation
}

export interface CharacterSelection {
  gender: 'male' | 'female';
  age: 'adult';
}

// FIX: Added missing types for Dance Arena feature
export type FormationType = 'line' | 'v-shape' | 'circle' | 'grid';

export interface DanceArenaSettings {
  dancerCount: number;
  formation: FormationType;
}
