export class AudioController {
    constructor() {
        this.ctx = null;
        this.ambience = null;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load Ambience
        this.loadSound('city_ambience.mp3').then(buffer => {
            if(!buffer) return;
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.3;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            source.start(0);
        });

        // Preload Click
        this.loadSound('ui_click.mp3').then(buffer => {
            this.clickBuffer = buffer;
        });
    }

    async loadSound(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn('Audio load failed', e);
            return null;
        }
    }

    playClick() {
        if (!this.ctx || !this.clickBuffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.clickBuffer;
        source.connect(this.ctx.destination);
        source.start(0);
    }
}