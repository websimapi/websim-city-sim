import * as THREE from 'three';
import { City } from './City.js';

export class World {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.city = new City();
        this.cameraAngle = 0;
    }

    init() {
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 500); // Increased fog distance for larger scale

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(200, 300, 100); // Higher light
        dirLight.castShadow = true;
        // Increase shadow frustum for larger city
        const d = 300;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // Renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Setup City Group
        this.scene.add(this.city.group);
        
        // Initial camera pos (Higher up)
        this.camera.position.set(0, 100, 100);
        this.camera.lookAt(0, 0, 0);
    }

    generateCity() {
        this.city.generate();
    }

    update(dt) {
        this.city.update(dt);
    }

    orbitCamera(dt) {
        // Fallback or high altitude view
        this.cameraAngle += dt * 0.05;
        const radius = 200; // Larger orbit
        this.camera.position.x = Math.sin(this.cameraAngle) * radius;
        this.camera.position.z = Math.cos(this.cameraAngle) * radius;
        this.camera.position.y = 150;
        this.camera.lookAt(0, 0, 0);
    }

    followTarget(targetPos, dt) {
        if (!targetPos) return;
        
        // Smooth follow with scale adjusted
        const offset = new THREE.Vector3(30, 30, 30); 
        const desiredPos = targetPos.clone().add(offset);
        
        // Lerp camera position
        this.camera.position.lerp(desiredPos, dt * 2);
        this.camera.lookAt(targetPos);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}