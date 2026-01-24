import { AudioController } from './AudioController.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.audio = new AudioController();
        
        this.overlay = document.getElementById('ui-overlay');
        this.titleScreen = document.getElementById('title-screen');
        this.settingsScreen = document.getElementById('settings-screen');
        this.charScreen = document.getElementById('char-creation-screen');
        this.hud = document.getElementById('hud');
        
        this.btnContinue = document.getElementById('btn-continue');
        this.btnStart = document.getElementById('btn-start');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnBack = document.getElementById('btn-back');
        this.btnMenu = document.getElementById('btn-menu');
        
        this.btnConfirmChar = document.getElementById('btn-confirm-char');
        this.btnCancelChar = document.getElementById('btn-cancel-char');
        
        this.statPop = document.getElementById('stat-pop');
        this.statCars = document.getElementById('stat-cars');

        this.selectedColor = '0xff6b6b';
        this.charNameInput = document.getElementById('char-name');
    }

    init() {
        // Check Save
        const hasSave = localStorage.getItem('metro_loop_save');
        if (hasSave) {
            this.btnContinue.classList.remove('hidden');
        }

        // Bind Events
        this.btnStart.addEventListener('click', () => {
            this.audio.playClick();
            this.titleScreen.classList.add('hidden');
            this.charScreen.classList.remove('hidden');
        });

        this.btnConfirmChar.addEventListener('click', () => {
            this.audio.playClick();
            const name = this.charNameInput.value || "Citizen";
            this.game.resetSimulation();
            // TODO: Pass character data if needed
            this.transitionToGame();
        });

        this.btnCancelChar.addEventListener('click', () => {
            this.audio.playClick();
            this.charScreen.classList.add('hidden');
            this.titleScreen.classList.remove('hidden');
        });

        this.setupColorPicker();

        this.btnContinue.addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToGame();
        });

        this.btnSettings.addEventListener('click', () => {
            this.audio.playClick();
            this.titleScreen.classList.add('hidden');
            this.settingsScreen.classList.remove('hidden');
        });

        this.btnBack.addEventListener('click', () => {
            this.audio.playClick();
            this.settingsScreen.classList.add('hidden');
            this.titleScreen.classList.remove('hidden');
        });
        
        this.btnMenu.addEventListener('click', () => {
            this.audio.playClick();
            this.transitionToMenu();
        });

        // Initialize Audio Context on first interaction
        window.addEventListener('click', () => {
            this.audio.init();
        }, { once: true });
    }

    setupColorPicker() {
        const options = document.querySelectorAll('.color-opt');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                this.audio.playClick();
                options.forEach(o => o.classList.remove('selected'));
                e.target.classList.add('selected');
                this.selectedColor = e.target.dataset.color;
            });
        });
    }

    transitionToGame() {
        this.titleScreen.classList.add('hidden');
        this.charScreen.classList.add('hidden');
        this.game.enterGameMode();
    }

    transitionToMenu() {
        this.titleScreen.classList.remove('hidden');
        this.game.exitGameMode();
    }
    
    setHUDVisible(visible) {
        if(visible) this.hud.classList.remove('hidden');
        else this.hud.classList.add('hidden');
    }

    updateStats(stats) {
        this.statPop.innerText = stats.pop;
        this.statCars.innerText = stats.cars;
    }
}