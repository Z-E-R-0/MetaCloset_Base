import { PoseLandmarker, ImageSegmenter, FilesetResolver } from 'https://esm.sh/v135/@mediapipe/tasks-vision@0.10.2';
import { SimpleMask } from '../types';

class MediaPipeService {
    private poseLandmarker: PoseLandmarker | null = null;
    private imageSegmenter: ImageSegmenter | null = null;
    private isInitializing = false;
    private isInitialized = false;

    async initialize() {
        if (this.isInitialized || this.isInitializing) {
            return;
        }
        this.isInitializing = true;
        try {
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
            );
            
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              numPoses: 1,
            });

            this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
                delegate: 'GPU',
              },
              runningMode: 'VIDEO',
              outputConfidenceMasks: true,
            });
            
            this.isInitialized = true;
            console.log("MediaPipeService initialized successfully.");
        } catch (error) {
            console.error("Failed to initialize MediaPipeService:", error);
            throw new Error("Failed to load AI models.");
        } finally {
            this.isInitializing = false;
        }
    }

    getPoseLandmarker(): PoseLandmarker | null {
        return this.poseLandmarker;
    }

    getImageSegmenter(): ImageSegmenter | null {
        return this.imageSegmenter;
    }

    async segmentImage(image: HTMLCanvasElement | HTMLImageElement): Promise<SimpleMask | null> {
        if (!this.imageSegmenter) {
            console.error("ImageSegmenter not initialized.");
            return null;
        }

        // Temporarily change running mode for single image processing.
        await this.imageSegmenter.setOptions({ runningMode: 'IMAGE' });
        
        const result = this.imageSegmenter.segment(image);

        // Change it back to VIDEO for the live feed.
        await this.imageSegmenter.setOptions({ runningMode: 'VIDEO' });

        if (result.confidenceMasks && result.confidenceMasks.length > 0) {
            const mask = result.confidenceMasks[0];
            const float32Array = mask.getAsFloat32Array();
            const uint8Array = new Uint8Array(float32Array.length);
            for (let i = 0; i < float32Array.length; i++) {
                // The value is the probability, from 0.0 to 1.0.
                // Convert it to a 0-255 alpha value for a smoother mask.
                const alpha = Math.round(float32Array[i] * 255);
                uint8Array[i] = alpha;
            }
            const maskCopy: SimpleMask = {
                buffer: uint8Array,
                width: mask.width,
                height: mask.height,
            };
            return maskCopy;
        }
        return null;
    }

    close() {
        this.poseLandmarker?.close();
        this.imageSegmenter?.close();
        this.isInitialized = false;
        console.log("MediaPipeService closed.");
    }
}

export const mediaPipeService = new MediaPipeService();