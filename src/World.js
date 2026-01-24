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
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(50, 100, 50);
        dirLight.castShadow = true;
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
        
        // Initial camera pos
        this.camera.position.set(0, 30, 40);
        this.camera.lookAt(0, 0, 0);
    }

    generateCity() {
        this.city.generate();
    }

    update(dt) {
        // Any global world animations
    }

    orbitCamera(dt) {
        // Slow rotation around the center
        this.cameraAngle += dt * 0.1;
        const radius = 60;
        this.camera.position.x = Math.sin(this.cameraAngle) * radius;
        this.camera.position.z = Math.cos(this.cameraAngle) * radius;
        this.camera.position.y = 40;
        this.camera.lookAt(0, 0, 0);
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