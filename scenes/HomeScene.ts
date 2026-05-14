import Phaser from "phaser";
import { homeBg } from "../atlasUrls";

export default class HomeScene extends Phaser.Scene { 

    background!: Phaser.GameObjects.Image;
    shadow!: Phaser.GameObjects.Rectangle;

    playText!: Phaser.GameObjects.Text;
    settingText!: Phaser.GameObjects.Text;
    multiplyerText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: "HomeScene" });
    }

    preload() {
        this.load.image("background", homeBg);
    }

    create() {

        // Background
        this.background = this.add.image(0, 0, "background")
            .setOrigin(0, 0)
            .setDepth(0);

        // Dark overlay
        this.shadow = this.add.rectangle(
            0,
            0,
            this.scale.width,
            this.scale.height,
            0x000000,
            0.4
        )
        .setOrigin(0, 0)
        .setDepth(1);

        // Shared text style
        const textStyle = {
            fontSize: "32px",
            fontFamily: "Arial",
            fontStyle: "bold",
            color: "#ffffff"
        };

        // Menu texts
        this.playText = this.add.text(0, 0, "Play Tournament", textStyle)
            .setOrigin(0.5)
            .setDepth(2);

        this.settingText = this.add.text(0, 0, "Settings", textStyle)
            .setOrigin(0.5)
            .setDepth(2);

        this.multiplyerText = this.add.text(0, 0, "Multiplayer", textStyle)
            .setOrigin(0.5)
            .setDepth(2);

        // Enable buttons (hover + click + cursor)
        this.makeButton(this.playText, "CharacterScene" , {mode : "singleplayer"});
        this.makeButton(this.settingText, "SettingsScene");
        this.makeButton(this.multiplyerText, "CharacterScene" , {mode : "multiplayer"});

        // Layout
        this.resize();
        this.scale.on("resize", this.resize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off("resize", this.resize, this);
        });
    }

    // 🔥 reusable button system
makeButton(
    text: Phaser.GameObjects.Text,
    targetScene: string,
    data?: any
){
    text.setInteractive({ useHandCursor: true })
    .on("pointerdown", () => {
        this.scene.start(targetScene, data);
    });

        // hover scale in
        text.on("pointerover", () => {
            text.setColor("yellow");
            this.tweens.add({
                targets: text,
                scale: 1.2,
                duration: 120,
                ease: "Back.Out"
            });
        });

        // hover scale out
        text.on("pointerout", () => {
                        text.setColor("#ffffff");

            this.tweens.add({
                targets: text,
                scale: 1,
                duration: 120,
                ease: "Back.Out"
            });
        });

        // click → scene change
        text.on("pointerdown", () => {
                        text.setColor("#ffffff");

            this.scene.start(targetScene);
        });
    }

    resize() {
        if (!this.background?.active || !this.shadow?.active) {
            return;
        }

        const { width, height } = this.scale;

        // background full screen
        this.background.setDisplaySize(width, height);

        // shadow full screen
        this.shadow.setSize(width, height);
        this.shadow.setPosition(0, 0);

        // center menu
        const centerX = width / 2;
        const centerY = height / 2;
        const spacing = 60;

        this.playText.setPosition(centerX, centerY - spacing);
        this.settingText.setPosition(centerX, centerY);
        this.multiplyerText.setPosition(centerX, centerY + spacing);
    }
}