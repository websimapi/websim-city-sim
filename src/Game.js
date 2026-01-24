import { World } from './World.js';
import { UIManager } from './UIManager.js';
import { EntityManager } from './Entities.js';

export class Game {
    constructor() {
        this.world = new World();
        this.ui = new UIManager(this);
        this.entities = new EntityManager(this.world);
        this.lastTime = 0;
        this.isPlaying = false; // "Playing" as in active gameplay, otherwise it's just screensaver
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
                this.world.orbitCamera(dt);
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
}