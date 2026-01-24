import { World } from './World.js';
import { UIManager } from './UIManager.js';
import { EntityManager } from './Entities.js';

export class Game {
    constructor() {
        this.world = new World();
        this.ui = new UIManager(this);
        this.entities = new EntityManager(this.world);
        this.lastTime = 0;
        this.isPlaying = false;
        
        // Cinematic camera settings
        this.camTimer = 0;
        this.camTarget = null;
    }

    init() {
        this.world.init();
        this.ui.init();
        this.entities.init();
        
        requestAnimationFrame((t) => this.loop(t));
        
        // Start simulated immediately for background effect
        this.startSimulation();
    }

    startSimulation() {
        this.world.generateCity();
        this.entities.spawnInitialPopulation();
    }

    resetSimulation() {
        this.entities.clear();
        this.world.generateCity(); // Regenerate city layout
        this.entities.spawnInitialPopulation();
    }

    loop(time) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (dt < 0.1) { // Prevent huge jumps
            this.entities.update(dt);
            this.world.update(dt);
            
            // Camera logic
            if (!this.isPlaying) {
                this.updateCinematicCamera(dt);
            }
        }

        this.world.render();
        this.ui.updateStats(this.entities.stats);
        
        requestAnimationFrame((t) => this.loop(t));
    }
    
    // Called when user clicks "Start" or "Continue"
    enterGameMode() {
        this.isPlaying = true;
        this.ui.setHUDVisible(true);
        // Save that we have a game in progress
        localStorage.setItem('metro_loop_save', 'true');
    }

    exitGameMode() {
        this.isPlaying = false;
        this.ui.setHUDVisible(false);
    }

    updateCinematicCamera(dt) {
        this.camTimer -= dt;
        
        // Switch target periodically
        if (this.camTimer <= 0) {
            this.camTimer = 8 + Math.random() * 5; // 8-13 seconds
            this.camTarget = this.entities.getRandomPedestrian();
        }

        if (this.camTarget && this.camTarget.mesh) {
            this.world.followTarget(this.camTarget.mesh.position, dt);
        } else {
            // Fallback if no target or target disappeared
            this.world.orbitCamera(dt);
            this.camTarget = this.entities.getRandomPedestrian();
        }
    }
}