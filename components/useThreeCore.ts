import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export interface ThreeCore {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    bloomPass: UnrealBloomPass;
    fxaaPass: ShaderPass;
    raycaster: THREE.Raycaster;
    groundPlaneMesh: THREE.Mesh;
    worldGroundPlane: THREE.Plane;
    gridHelper: THREE.GridHelper;
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    backLight: THREE.DirectionalLight;
    ambientLight: THREE.AmbientLight;
}

interface UseThreeCoreProps {
  mountRef: React.RefObject<HTMLDivElement>;
  hdriUrl?: string;
  transparent?: boolean;
  cameraType?: 'orthographic' | 'perspective';
}

export const useThreeCore = ({ mountRef, hdriUrl, transparent = true, cameraType = 'orthographic' }: UseThreeCoreProps): ThreeCore | null => {
    const [core, setCore] = useState<ThreeCore | null>(null);

    useEffect(() => {
        if (!mountRef.current) return;
        const currentMount = mountRef.current;
        const { clientWidth: width, clientHeight: height } = currentMount;

        const scene = new THREE.Scene();
        scene.background = transparent ? null : new THREE.Color(0x111111);
        
        const camera = cameraType === 'perspective'
            ? new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
            : new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 1, 1000);

        if (cameraType === 'perspective') {
            camera.position.set(0, 1.5, 4);
        } else {
            camera.position.z = 500;
        }

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: transparent, preserveDrawingBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        const canvas = renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        currentMount.appendChild(canvas);

        const effectiveHdriUrl = hdriUrl || 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr';
        if (effectiveHdriUrl) {
            new RGBELoader().load(effectiveHdriUrl, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
            }, undefined, (error) => {
                console.error(`An error occurred loading the HDRI from ${effectiveHdriUrl}:`, error);
            });
        }
        
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(1, 1, 2);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-1, 0.5, 2);
        scene.add(fillLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.6);
        backLight.position.set(0, 2, -3);
        scene.add(backLight);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);

        const raycaster = new THREE.Raycaster();
        
        const initialGroundY = -120;
        const planeGeo = new THREE.PlaneGeometry(10000, 10000);
        const planeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false });
        const groundPlaneMesh = new THREE.Mesh(planeGeo, planeMat);
        groundPlaneMesh.rotation.x = -Math.PI / 2;
        groundPlaneMesh.position.y = initialGroundY;
        groundPlaneMesh.renderOrder = -9999;
        groundPlaneMesh.userData.isGroundPlane = true;
        scene.add(groundPlaneMesh);
        const worldGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -initialGroundY);

        const gridHelper = new THREE.GridHelper(1000, 20, 0xaaaaaa, 0x666666);
        gridHelper.position.y = initialGroundY;
        gridHelper.visible = false;
        scene.add(gridHelper);

        // Post-processing setup
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.6;
        bloomPass.strength = 0.35;
        bloomPass.radius = 0.3;
        composer.addPass(bloomPass);

        const fxaaPass = new ShaderPass(FXAAShader);
        const pixelRatio = renderer.getPixelRatio();
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (width * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (height * pixelRatio);
        composer.addPass(fxaaPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);
        
        setCore({ scene, camera, renderer, composer, bloomPass, fxaaPass, raycaster, groundPlaneMesh, worldGroundPlane, gridHelper, keyLight, fillLight, backLight, ambientLight });

        const handleResize = () => {
            if (!mountRef.current || !renderer || !camera) return;
            const { clientWidth: w, clientHeight: h } = mountRef.current;
            if (w === 0 || h === 0) return; // skip until we have real dimensions
            
            renderer.setSize(w, h);
            composer.setSize(w, h);
            
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = w / h;
            } else {
                (camera as THREE.OrthographicCamera).left = w / -2;
                (camera as THREE.OrthographicCamera).right = w / 2;
                (camera as THREE.OrthographicCamera).top = h / 2;
                (camera as THREE.OrthographicCamera).bottom = h / -2;
            }
            camera.updateProjectionMatrix();

            bloomPass.setSize(w, h);
            const pRatio = renderer.getPixelRatio();
            fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * pRatio);
            fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * pRatio);
        };

        // ResizeObserver ensures canvas updates when container size changes (e.g. on maximize or layout)
        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(currentMount);
        window.addEventListener('resize', handleResize);
        // Run once after a frame in case container had 0 size on mount (e.g. maximized window)
        const rafId = requestAnimationFrame(() => {
            handleResize();
        });
        return () => {
            cancelAnimationFrame(rafId);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            if (renderer && renderer.domElement.parentElement === currentMount) {
                currentMount.removeChild(renderer.domElement);
            }
        };
    }, [mountRef, hdriUrl, transparent, cameraType]);

    return core;
};
