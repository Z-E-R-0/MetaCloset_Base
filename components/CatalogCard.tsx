import React, { FC, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Garment } from '../types';
import { IconSpinner } from './Icons';

interface CatalogCardProps {
    garment: Garment;
    onSelect: (garment: Garment) => void;
}

const CatalogCard: FC<CatalogCardProps> = ({ garment, onSelect }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const observerRef = useRef<IntersectionObserver | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        observerRef.current?.unobserve(currentMount); // Load once
                    }
                });
            },
            { threshold: 0.1 }
        );

        observerRef.current.observe(currentMount);

        return () => {
            if (observerRef.current && currentMount) {
                observerRef.current.unobserve(currentMount);
            }
        };
    }, []);

    useEffect(() => {
        if (!isVisible || !mountRef.current) return;

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
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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
            
            model.position.x += (model.position.x - center.x);
            model.position.y += (model.position.y - center.y);
            model.position.z += (model.position.z - center.z);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.0 / maxDim;
            model.scale.set(scale, scale, scale);
            
            scene.add(model);
            setIsLoading(false);
        });

        let animationFrameId: number;
        const animate = () => {
            if (model) {
                model.rotation.y += 0.01;
            }
            renderer.render(scene, camera);
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (rendererRef.current && rendererRef.current.domElement.parentElement === currentMount) {
                currentMount.removeChild(rendererRef.current.domElement);
                rendererRef.current.dispose();
            }
            scene.clear();
        };
    }, [garment.modelUrl, isVisible]);

    return (
        <button
            onClick={() => onSelect(garment)}
            className="group glassmorphic rounded-lg p-3 flex flex-col items-center justify-center text-center aspect-[4/5]
                       transition-all duration-300 ease-in-out transform hover:scale-105 hover:border-lime-400 hover:shadow-[0_0_25px_rgba(163,230,53,0.4)]"
        >
            <div className="flex-grow w-full h-full flex items-center justify-center mb-2 overflow-hidden rounded-md bg-black/20 relative">
                 <div className="absolute top-2 left-2 z-20 bg-black/50 text-lime-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                    MetaCloset
                 </div>
                 {/* Static Preview Image */}
                 {garment.previewImageUrl && (
                    <img
                        src={garment.previewImageUrl}
                        alt={garment.name}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${!isLoading ? 'opacity-0' : 'opacity-100'}`}
                    />
                 )}
                 
                 {/* Loading Spinner */}
                 {isLoading && isVisible && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <IconSpinner className="w-8 h-8 animate-spin text-lime-400" />
                    </div>
                 )}
                 
                 {/* 3D Canvas (fades in) */}
                 <div
                    ref={mountRef}
                    className={`w-full h-full transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                 />
            </div>
            <span className="font-semibold text-zinc-200 truncate w-full text-sm">{garment.name}</span>
        </button>
    );
};

export default CatalogCard;