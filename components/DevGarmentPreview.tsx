import React, { FC, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Garment } from '../types';
import { IconSpinner } from './Icons';

interface DevGarmentPreviewProps {
    garment: Garment;
}

const DevGarmentPreview: FC<DevGarmentPreviewProps> = ({ garment }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    useEffect(() => {
        if (!mountRef.current || !garment.modelUrl) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const currentMount = mountRef.current;
        const { clientWidth: width, clientHeight: height } = currentMount;
        
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
        camera.position.z = 1.5;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        rendererRef.current = renderer;
        currentMount.appendChild(renderer.domElement);
        
        const orbitControls = new OrbitControls(camera, renderer.domElement);
        orbitControls.enableDamping = true;
        orbitControls.minDistance = 0.5;
        orbitControls.maxDistance = 5;
        orbitControls.target.set(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
        directionalLight.position.set(1, 2, 3);
        scene.add(directionalLight);
        
        const loader = new GLTFLoader();
        let model: THREE.Group;
        loader.load(garment.modelUrl, (gltf) => {
            model = gltf.scene;

            // Auto-center and scale model
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            model.position.sub(center);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const baseScale = 1.0 / maxDim;
            model.scale.setScalar(baseScale);

            // Apply preview-specific adjustments
            const previewScale = garment.previewScale ?? 1;
            const previewPosition = garment.previewPosition ?? { x: 0, y: 0, z: 0 };
            
            model.scale.multiplyScalar(previewScale);
            model.position.add(new THREE.Vector3(previewPosition.x, previewPosition.y, previewPosition.z));
            
            scene.add(model);
            setIsLoading(false);
        }, undefined, (error) => {
            console.error("Failed to load model for preview:", error);
            setIsLoading(false);
        });

        let animationFrameId: number;
        const animate = () => {
            orbitControls.update();
            renderer.render(scene, camera);
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            orbitControls.dispose();
            if (rendererRef.current && rendererRef.current.domElement.parentElement === currentMount) {
                currentMount.removeChild(rendererRef.current.domElement);
            }
            renderer.dispose();
            scene.clear();
        };
    }, [garment]);

    return (
        <div className="w-full h-full rounded-md bg-zinc-800 relative">
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <IconSpinner className="w-8 h-8 animate-spin text-amber-400" />
                </div>
            )}
             {!garment.modelUrl && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-center text-zinc-500 text-sm p-4">
                    <p>No model URL provided for this garment.</p>
                </div>
            )}
            <div
                ref={mountRef}
                className={`w-full h-full transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
             />
        </div>
    );
};

export default DevGarmentPreview;