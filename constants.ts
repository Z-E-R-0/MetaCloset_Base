import { Garment, BackgroundImage, BrandAssets, AppConfig, Animation, Accessory, Avatar } from './types';

// Using the local model provided by the user.
const T_SHIRT_RIGGED_URL = '/models/t_shirt_rigged.glb';
export const Y_BOT_URL = '/models/y_bot.glb';

// --- RIGGED GARMENT NOTES ---
// 'scale': A multiplier to adjust the garment's fit. A value of 1.0 is the neutral base,
//          relying on the automatic scaling from the user's pose.
// 'yOffset': A value to fine-tune how far the garment hangs below the hip line, represented as
//            a fraction of the user's torso height. NOTE: This is currently only used for non-rigged garments.

export const DEFAULT_BRAND_ASSETS: BrandAssets = {
  logoUrl: '',
  assetUrl1: '',
  assetUrl2: '',
  assetUrl3: '',
  hdriUrl: '',
  shareOverlayUrl: '',
  yBotUrl: Y_BOT_URL, // Keep the essential local driver model
};


export const DEFAULT_GARMENTS: Garment[] = [];

// The application starts with an empty list of accessories.
// You can add new accessories using the Dev Configuration page.
// 'scale' is a multiplier for the accessory's size.
// 'positionOffset' and 'rotationOffset' are in the local space of the 'attachmentBone'.
export const DEFAULT_ACCESSORIES: Accessory[] = [];


export const DEFAULT_BACKGROUND_IMAGES: BackgroundImage[] = [
    { id: 'original', name: 'Original', url: 'original' }, // Special case for keeping original background
];

export const DEFAULT_ANIMATIONS: Animation[] = [];

export const DEFAULT_AVATARS: Avatar[] = [
    {
      id: 'female_bot_1',
      name: 'Aura',
      modelUrl: Y_BOT_URL, // Placeholder, user should replace in DevPage
      gender: 'Female',
    },
    {
      id: 'male_bot_1',
      name: 'Jax',
      modelUrl: Y_BOT_URL, // Placeholder
      gender: 'Male',
    },
    {
      id: 'male_bot_2',
      name: 'Cypher',
      modelUrl: Y_BOT_URL, // Placeholder
      gender: 'Male',
    }
];

export const DEFAULT_CONFIG: AppConfig = {
    garments: DEFAULT_GARMENTS,
    accessories: DEFAULT_ACCESSORIES,
    backgroundImages: DEFAULT_BACKGROUND_IMAGES,
    brandAssets: DEFAULT_BRAND_ASSETS,
    animations: DEFAULT_ANIMATIONS,
    avatars: DEFAULT_AVATARS,
    defaultIKPose: undefined,
};

export const DEBUGGABLE_BONES: string[] = [
    'Hips',
    'Spine',
    'Spine1',
    'Spine2',
    'Neck',
    'Head',
    'LeftShoulder',
    'LeftArm',
    'LeftForeArm',
    'LeftHand',
    'RightShoulder',
    'RightArm',
    'RightForeArm',
    'RightHand',
    'LeftUpLeg',
    'LeftLeg',
    'LeftFoot',
    'RightUpLeg',
    'RightLeg',
    'RightFoot',
];

// Connections for drawing the pose skeleton
export const POSE_CONNECTIONS: [number, number][] = [
  // Torso
  [11, 12], // Left shoulder to right shoulder
  [12, 24], // Right shoulder to right hip
  [24, 23], // Right hip to left hip
  [23, 11], // Left hip to left shoulder

  // Left arm
  [11, 13], // Left shoulder to left elbow
  [13, 15], // Left elbow to left wrist

  // Right arm
  [12, 14], // Right shoulder to right elbow
  [14, 16], // Right elbow to right wrist

  // Left leg
  [23, 25], // Left hip to left knee
  [25, 27], // Left knee to left ankle

  // Right leg
  [24, 26], // Right hip to right knee
  [26, 28], // Right knee to right ankle
];