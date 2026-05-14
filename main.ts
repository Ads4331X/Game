import Phaser from 'phaser';
import HomeScene from './scenes/HomeScene';
import CharacterScene from './scenes/CharacterScene';
import {SpriteDebugScene} from './scenes/SpriteDebugScene';
import FightScene from './scenes/FightScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',

    backgroundColor: '#0a0a1a',

    physics: {
        default: 'arcade',
        arcade: {
            gravity: {x:0, y: 0 },   
            debug: false
        }
    },

    render: {
        pixelArt: true,
        antialias: false,
    },

    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    scene: [HomeScene, CharacterScene, FightScene],
};
const game = new Phaser.Game(config);

