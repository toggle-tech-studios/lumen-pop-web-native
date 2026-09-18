import { Scene } from 'phaser';

export default class MainMenu extends Scene {
    constructor() {
        super('MainMenu');
    }

    create() {
        // Background
        this.add.rectangle(180, 320, 360, 640, 0x12053c);

        // Blobs
        this.add.circle(60, 100, 56, 0x67e8f9, 0.15);
        this.add.circle(300, 500, 88, 0xf9a8d4, 0.15);

        // Logo
        const logo = this.add.image(180, 120, 'logo');
        logo.setScale(0.8);

        this.add.text(180, 200, 'A pocket adventure of tiny lights', {
            fontFamily: 'sans-serif',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.64)',
            letterSpacing: 2
        }).setOrigin(0.5);

        this.add.text(180, 250, 'Wake the wonder.\nPop the light.', {
            fontFamily: 'sans-serif',
            fontSize: '28px',
            color: '#ffffff',
            align: 'center',
            
        }).setOrigin(0.5);

        // Play Button
        const playBtn = this.add.rectangle(180, 400, 200, 50, 0x67e8f9, 1).setInteractive();
        playBtn.setInteractive({ useHandCursor: true });
        
        this.add.text(180, 400, 'Begin the journey', {
            fontFamily: 'sans-serif',
            fontSize: '16px',
            color: '#291063',
            
        }).setOrigin(0.5);

        playBtn.on('pointerdown', () => {
            playBtn.setFillStyle(0x38bdf8);
        });

        playBtn.on('pointerup', () => {
            playBtn.setFillStyle(0x67e8f9);
            this.scene.start('Game');
        });
    }
}
