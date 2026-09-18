import Phaser from 'phaser';
import Preloader from './scenes/Preloader';
import MainMenu from './scenes/MainMenu';
import Game from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: 360,
    height: 640,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#12053c',
    scene: [Preloader, MainMenu, Game]
};

export default new Phaser.Game(config);
