// PreloadScene.ts
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    
    constructor() {
        super({ key: 'PreloadScene' });
    }
    
    preload() {
        // Loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width/2 - 160, height/2 - 25, 320, 50);
        
        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0xffdd00, 1);
            progressBar.fillRect(width/2 - 150, height/2 - 15, 300 * value, 30);
        });
        
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
        });

        // Ryu: TexturePacker atlases (Ryu-0 / Ryu-1) load in SpriteDebugScene / CharacterScene — not a uniform spritesheet.
    }
    
    create() {
        // Go to debug scene first to check frames
        // After you find correct frame size, change to CharacterSelectScene
        this.scene.start('SpriteDebugScene');
        // this.scene.start('CharacterSelectScene');
    }
}