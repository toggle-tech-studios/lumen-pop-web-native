import { Scene } from 'phaser';

export default class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        // Load assets
        this.load.image('logo', 'assets/lumen-pop-logo.png');
        this.load.image('bg1', 'assets/bg_level_1.png');
        this.load.image('bg2', 'assets/bg_level_2.png');
        
        const lumens = ['aether', 'blaze', 'nova', 'solar', 'terra'];
        lumens.forEach(color => {
            this.load.image(color, `assets/${color}_closed.png`);
        });

        // Simple loading bar
        let graphics = this.add.graphics();
        this.load.on('progress', (value: number) => {
            graphics.clear();
            graphics.fillStyle(0x67e8f9, 1);
            graphics.fillRect(80, 320, 200 * value, 20);
        });
        this.load.on('complete', () => {
            graphics.destroy();
        });
    }

    create() {
        this.scene.start('MainMenu');
    }
}
