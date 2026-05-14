import Phaser from "phaser";
import { CHARACTER_ROSTER, expandFrameRange, GAMEPLAY_ANIM_IDS } from "../characterMoves";

const PORTRAIT_SIZE = 60;
const GRID_GAP = 10;
const GRID_COLS = 7;
const HIGHLIGHT_COLOR = 0xffdd00;
const HOVER_COLOR = 0x333366;
const NORMAL_COLOR = 0x222244;

export default class CharacterScene extends Phaser.Scene {
    private mode!: "singleplayer" | "multiplayer";
    private selected: [number | null, number | null] = [null, null];
    private hovered: number = 0;
    private currentPlayer: 0 | 1 = 0;
    
    private confirmedP1 = false;
    private confirmedP2 = false;
    private confirmed = false;

    private p1Sprite: Phaser.GameObjects.Sprite | null = null;
    private p2Sprite: Phaser.GameObjects.Sprite | null = null;

    private portraitHighlights: Phaser.GameObjects.Rectangle[] = [];
    private portraitBgs: Phaser.GameObjects.Rectangle[] = [];
    private hintText: Phaser.GameObjects.Text | null = null;
    private startButton: Phaser.GameObjects.Text | null = null;

    constructor() {
        super({ key: "CharacterScene" });
    }

    preload() {
        for (const char of CHARACTER_ROSTER) {
            this.load.atlas(char.atlasKey, char.atlas.image, char.atlas.json);
            if (char.portraitPfp) {
                this.load.image(char.portraitPfp.loaderKey, char.portraitPfp.url);
            }
        }
        this.load.on("loaderror", (file: Phaser.Loader.File) => {
            console.error("FAIL:", file.key, file.url);
        });
    }

    init(data?: { mode?: string }) {
        this.mode = data?.mode === "multiplayer" ? "multiplayer" : "singleplayer";
        this.selected = [null, null];
        this.hovered = 0;
        this.currentPlayer = 0;
        this.confirmedP1 = false;
        this.confirmedP2 = false;
        this.confirmed = false;
    }

    create() {
        const { width, height } = this.scale;

        const missingAtlas = CHARACTER_ROSTER.filter((c) => !this.textures.exists(c.atlasKey));
        if (CHARACTER_ROSTER.length === 0 || missingAtlas.length > 0) {
            const detail =
                missingAtlas.length > 0
                    ? `Missing: ${missingAtlas.map((c) => c.atlasKey).join(", ")}`
                    : "No characters in roster.";
            this.add.text(width / 2, height / 2, `ERROR: Could not load atlas.\n${detail}`, {
                fontSize: "18px",
                color: "#ff0000",
                align: "center",
            }).setOrigin(0.5);
            return;
        }

        this.registerAnimations();

        this.add.rectangle(0, 0, width, height, 0x0a0a1a).setOrigin(0);
        const gfx = this.add.graphics();
        gfx.lineStyle(1, 0xffffff, 0.04);
        for (let x = 0; x < width; x += 40) gfx.lineBetween(x, 0, x, height);
        for (let y = 0; y < height; y += 40) gfx.lineBetween(0, y, width, y);

        this.add.text(width / 2, 35, "SELECT YOUR FIGHTER", {
            fontSize: "30px",
            fontFamily: "Arial Black",
            fontStyle: "bold",
            color: "#ffdd00",
            stroke: "#000",
            strokeThickness: 6,
        }).setOrigin(0.5);

        const feetY = height * 1.1;

        if (this.mode === "singleplayer") {
            this.buildPreview(width * 0.25, feetY, "P1", 0);
        } else {
            this.buildPreview(width * 0.22, feetY, "P1", 0);
            this.buildPreview(width * 0.78, feetY, "P2", 1);
        }

        this.buildGrid(width / 2, height * 0.76);

        this.hintText = this.add
            .text(
                width / 2,
                height - 25,
                this.getHintText(),
                { fontSize: "14px", fontFamily: "Arial", color: "#888888" }
            )
            .setOrigin(0.5);

        this.refreshPreviews();
        this.refreshHighlights();

        this.input.keyboard!.on("keydown", this.handleKeyInput, this);
    }

    private getHintText(): string {
        if (this.mode === "singleplayer") {
            if (this.confirmedP1) {
                return "Press ENTER or click START FIGHT to begin";
            }
            if (this.selected[0] !== null) {
                return "Double-click to confirm  |  ESC to unselect  |  Arrows to change";
            }
            return "Arrows to move  |  Enter/Space to select  |  Double-click to confirm";
        }
        
        if (this.confirmedP1 && this.confirmedP2) {
            return "Press ENTER or click START FIGHT to begin!";
        }
        if (this.currentPlayer === 0) {
            if (this.confirmedP1) {
                return "P1 confirmed! Waiting for P2...  |  ESC to undo";
            }
            if (this.selected[0] !== null) {
                return "P1: Double-click to confirm  |  ESC to unselect  |  Arrows to change";
            }
            return "P1: Arrows to move  |  Enter/Space to select";
        }
        
        if (this.confirmedP2) {
            return "P2 confirmed! Press ENTER or click START FIGHT";
        }
        if (this.selected[1] !== null) {
            return "P2: Double-click to confirm  |  ESC to unselect  |  Arrows to change";
        }
        if (this.confirmedP1) {
            return "P2: Arrows to move  |  Enter/Space to select  |  P1 can ESC to undo";
        }
        return "P2: Arrows to move  |  Enter/Space to select";
    }

    private registerAnimations() {
        for (const char of CHARACTER_ROSTER) {
            for (const name of GAMEPLAY_ANIM_IDS) {
                const animKey = `${char.key}_${name}`;
                if (this.anims.exists(animKey)) continue;

                const range = char.gameplayRange(name);
                const frameNames = expandFrameRange(range, char.frameName);
                const validFrames = frameNames.filter((fn) => this.textures.get(char.atlasKey).has(fn));
                if (validFrames.length === 0) continue;

                this.anims.create({
                    key: animKey,
                    frames: validFrames.map((fn) => ({ key: char.atlasKey, frame: fn })),
                    frameRate: name === "idle" ? 6 : 10,
                    repeat:
                        name === "idle" || name === "walkForward" || name === "walkBackward" ? -1 : 0,
                });
            }
        }
    }

    private buildPreview(cx: number, feetY: number, label: string, side: 0 | 1) {
        const char = CHARACTER_ROSTER[0];
        const frameData = this.textures.get(char.atlasKey).get(char.portraitFrame);
        const frameH = frameData ? frameData.height : 103;
        const targetHeight = this.scale.height * 0.35;
        const spriteScale = targetHeight / frameH;
        const spriteDisplayH = frameH * spriteScale;
        const spriteCenterY = feetY - spriteDisplayH / 2;

        if (label) {
            this.add
                .text(cx, spriteCenterY - spriteDisplayH / 2 - 5, label, {
                    fontSize: "18px",
                    fontFamily: "Arial Black",
                    fontStyle: "bold",
                    color: side === 0 ? "#44aaff" : "#ff6644",
                    stroke: "#000",
                    strokeThickness: 3,
                })
                .setOrigin(0.5, 1)
                .setDepth(8);
        }

        const sprite = this.add
            .sprite(cx, feetY, char.atlasKey, char.portraitFrame)
            .setOrigin(0.5, 1)
            .setScale(spriteScale)
            .setDepth(7);

        if (side === 0) this.p1Sprite = sprite;
        else this.p2Sprite = sprite;
    }

    private buildGrid(cx: number, cy: number) {
        const cellSize = PORTRAIT_SIZE + GRID_GAP;
        const totalCols = Math.min(CHARACTER_ROSTER.length, GRID_COLS);
        const totalRows = Math.ceil(CHARACTER_ROSTER.length / GRID_COLS);
        const gridWidth = totalCols * cellSize - GRID_GAP;
        const gridHeight = totalRows * cellSize - GRID_GAP;
        const startX = cx - gridWidth / 2 + PORTRAIT_SIZE / 2;
        const startY = cy - gridHeight / 2 + PORTRAIT_SIZE / 2;

        this.add
            .rectangle(cx, cy, gridWidth + 15, gridHeight + 15, 0x000022, 0.3)
            .setStrokeStyle(1, 0x4444aa, 0.3);

        CHARACTER_ROSTER.forEach((char, index) => {
            const col = index % totalCols;
            const row = Math.floor(index / totalCols);
            const x = startX + col * cellSize;
            const y = startY + row * cellSize;

            const bg = this.add
                .rectangle(x, y, PORTRAIT_SIZE, PORTRAIT_SIZE, NORMAL_COLOR)
                .setStrokeStyle(2, 0x4444aa, 0.7)
                .setInteractive({ useHandCursor: true });
            this.portraitBgs[index] = bg;

            if (char.portraitPfp) {
                this.add
                    .image(x, y, char.portraitPfp.loaderKey)
                    .setDisplaySize(PORTRAIT_SIZE - 10, PORTRAIT_SIZE - 10);
            } else {
                this.add
                    .sprite(x, y, char.atlasKey, char.portraitFrame)
                    .setDisplaySize(PORTRAIT_SIZE - 10, PORTRAIT_SIZE - 10);
            }

            const hl = this.add
                .rectangle(x, y, PORTRAIT_SIZE, PORTRAIT_SIZE, HIGHLIGHT_COLOR, 0)
                .setStrokeStyle(3, HIGHLIGHT_COLOR, 0);
            this.portraitHighlights[index] = hl;

            this.add
                .text(x, y + PORTRAIT_SIZE / 2 + 10, char.displayName, {
                    fontSize: "10px",
                    fontFamily: "Arial",
                    fontStyle: "bold",
                    color: "#aaaacc",
                })
                .setOrigin(0.5);

            bg.on("pointerover", () => {
                if (!this.isConfirmedSelected(index)) {
                    this.hovered = index;
                    this.refreshHighlights();
                }
            });
        });

        let lastClickTime = 0;
        let lastClickIndex = -1;

        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            const now = Date.now();
            const gameObjects = this.input.hitTestPointer(pointer);
            const clickedBg = gameObjects.find((go) => this.portraitBgs.includes(go as Phaser.GameObjects.Rectangle));
            if (!clickedBg) return;
            
            const index = this.portraitBgs.indexOf(clickedBg as Phaser.GameObjects.Rectangle);
            if (index === -1) return;

            if (now - lastClickTime < 300 && lastClickIndex === index) {
                this.onDoubleClick(index);
            } else {
                this.onSelect(index);
            }
            
            lastClickTime = now;
            lastClickIndex = index;
        });
    }

    private handleKeyInput(event: KeyboardEvent) {
        if (this.confirmed) return;
        
        const bothConfirmed = this.mode === "singleplayer" 
            ? this.confirmedP1 
            : (this.confirmedP1 && this.confirmedP2);
        
        if (bothConfirmed && (event.code === "Enter" || event.code === "Space")) {
            this.startFight();
            return;
        }

        const totalCols = Math.min(CHARACTER_ROSTER.length, GRID_COLS);
        const totalRows = Math.ceil(CHARACTER_ROSTER.length / GRID_COLS);
        const currentCol = this.hovered % totalCols;
        const currentRow = Math.floor(this.hovered / totalCols);

        switch (event.code) {
            case "ArrowLeft":
                if (currentCol > 0) {
                    this.hovered = this.hovered - 1;
                    this.refreshHighlights();
                }
                break;
            case "ArrowRight":
                if (currentCol < totalCols - 1 && this.hovered < CHARACTER_ROSTER.length - 1) {
                    this.hovered = this.hovered + 1;
                    this.refreshHighlights();
                }
                break;
            case "ArrowUp":
                if (currentRow > 0) {
                    this.hovered = this.hovered - totalCols;
                    this.refreshHighlights();
                }
                break;
            case "ArrowDown":
                if (currentRow < totalRows - 1 && this.hovered + totalCols < CHARACTER_ROSTER.length) {
                    this.hovered = this.hovered + totalCols;
                    this.refreshHighlights();
                }
                break;
            case "Enter":
            case "Space":
                if (!bothConfirmed) {
                    this.onSelect(this.hovered);
                }
                break;
            case "Escape":
                this.onUnselect();
                break;
        }
    }

    private onSelect(index: number) {
        if (this.confirmed) return;
        
        this.hovered = index;
        
        if (this.mode === "singleplayer") {
            this.selected[0] = index;
        } else {
            this.selected[this.currentPlayer] = index;
        }
        
        this.refreshPreviews();
        this.refreshHighlights();
        
        if (this.hintText) {
            this.hintText.setText(this.getHintText());
        }
    }

    private onDoubleClick(index: number) {
        if (this.confirmed) return;
        
        if (this.mode === "singleplayer") {
            if (this.selected[0] !== index) {
                this.onSelect(index);
            }
            this.confirmedP1 = true;
        } else {
            if (this.selected[this.currentPlayer] !== index) {
                this.onSelect(index);
            }
            
            if (this.currentPlayer === 0) {
                this.confirmedP1 = true;
                this.currentPlayer = 1;
                this.hovered = 0;
            } else {
                this.confirmedP2 = true;
            }
        }
        
        this.refreshPreviews();
        this.refreshHighlights();
        
        if (this.hintText) {
            this.hintText.setText(this.getHintText());
        }
        
        this.updateStartButton();
    }

    private onUnselect() {
        if (this.confirmed) return;
        
        if (this.mode === "singleplayer") {
            if (this.confirmedP1) {
                this.confirmedP1 = false;
                this.selected[0] = null;
            } else {
                this.selected[0] = null;
            }
        } else {
            if (this.currentPlayer === 1) {
                if (this.confirmedP2) {
                    this.confirmedP2 = false;
                    this.selected[1] = null;
                } else if (this.confirmedP1) {
                    this.confirmedP1 = false;
                    this.selected[0] = null;
                    this.currentPlayer = 0;
                    this.hovered = this.selected[0] ?? 0;
                } else if (this.selected[1] !== null) {
                    this.selected[1] = null;
                } else if (this.selected[0] !== null) {
                    this.selected[0] = null;
                    this.currentPlayer = 0;
                }
            } else {
                if (this.confirmedP1) {
                    this.confirmedP1 = false;
                    this.selected[0] = null;
                } else {
                    this.selected[0] = null;
                }
            }
        }
        
        this.updateStartButton();
        this.refreshPreviews();
        this.refreshHighlights();
        
        if (this.hintText) {
            this.hintText.setText(this.getHintText());
        }
    }

    private isConfirmedSelected(index: number): boolean {
        return (this.selected[0] === index && this.confirmedP1) || 
               (this.selected[1] === index && this.confirmedP2);
    }

    private updateStartButton() {
        const canStart = this.mode === "singleplayer" 
            ? this.confirmedP1 
            : (this.confirmedP1 && this.confirmedP2);
        
        if (!canStart) {
            if (this.startButton) {
                this.startButton.destroy();
                this.startButton = null;
            }
            return;
        }
        
        if (this.startButton) return;
        
        const { width, height } = this.scale;
        this.startButton = this.add.text(
            width / 2,
            height - 80,
            "▶ START FIGHT",
            {
                fontSize: "24px",
                fontFamily: "Arial Black",
                fontStyle: "bold",
                color: "#00ff00",
                backgroundColor: "#003300",
                padding: { x: 20, y: 10 },
            }
        ).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(100);
        
        this.startButton.on("pointerdown", () => this.startFight());
        this.startButton.on("pointerover", () => {
            this.startButton!.setStyle({ color: "#88ff88", backgroundColor: "#005500" });
        });
        this.startButton.on("pointerout", () => {
            this.startButton!.setStyle({ color: "#00ff00", backgroundColor: "#003300" });
        });
        
        this.tweens.add({
            targets: this.startButton,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });
    }

    private refreshPreviews() {
        if (this.p1Sprite) {
            const p1Selected = this.selected[0];
            if (p1Selected !== null) {
                const char = CHARACTER_ROSTER[p1Selected];
                this.p1Sprite.setTexture(char.atlasKey, char.portraitFrame);
                if (!this.p1Sprite.anims.isPlaying || this.p1Sprite.anims.currentAnim?.key !== `${char.key}_idle`) {
                    this.p1Sprite.play(`${char.key}_idle`);
                }
                this.p1Sprite.setVisible(true);
            } else {
                this.p1Sprite.setVisible(false);
            }
            this.p1Sprite.setFlipX(true);
        }

        const p2Index = this.mode === "singleplayer" ? null : this.selected[1];
        if (this.p2Sprite) {
            if (p2Index !== null) {
                const char = CHARACTER_ROSTER[p2Index];
                this.p2Sprite.setTexture(char.atlasKey, char.portraitFrame);
                if (!this.p2Sprite.anims.isPlaying || this.p2Sprite.anims.currentAnim?.key !== `${char.key}_idle`) {
                    this.p2Sprite.play(`${char.key}_idle`);
                }
                this.p2Sprite.setVisible(true);
            } else {
                this.p2Sprite.setVisible(false);
            }
            this.p2Sprite.setFlipX(false);
        }
    }

    private refreshHighlights() {
        const totalCols = Math.min(CHARACTER_ROSTER.length, GRID_COLS);
        
        this.portraitHighlights.forEach((hl, index) => {
            if (!hl) return;
            
            const isHovered = index === this.hovered;
            const isP1Selected = this.selected[0] === index;
            const isP2Selected = this.selected[1] === index;
            const isP1Confirmed = isP1Selected && this.confirmedP1;
            const isP2Confirmed = isP2Selected && this.confirmedP2;
            
            if (isP1Confirmed || isP2Confirmed) {
                hl.setStrokeStyle(3, 0x00ff00, 1);
                hl.setFillStyle(0x00ff00, 0.15);
            }
            else if (isP1Selected && !isP2Selected) {
                hl.setStrokeStyle(3, 0x44aaff, 1);
                hl.setFillStyle(0x44aaff, 0.25);
            }
            else if (isP2Selected && !isP1Selected) {
                hl.setStrokeStyle(3, 0xff6644, 1);
                hl.setFillStyle(0xff6644, 0.25);
            }
            else if (isHovered) {
                hl.setStrokeStyle(2, 0xffffff, 0.8);
                hl.setFillStyle(0xffffff, 0.1);
            }
            else {
                hl.setStrokeStyle(3, HIGHLIGHT_COLOR, 0);
                hl.setFillStyle(HIGHLIGHT_COLOR, 0);
            }
        });

        this.portraitBgs.forEach((bg, index) => {
            if (!bg) return;
            const isHovered = index === this.hovered;
            const isSelected = this.selected[0] === index || this.selected[1] === index;
            const isConfirmed = (this.selected[0] === index && this.confirmedP1) || 
                               (this.selected[1] === index && this.confirmedP2);
            
            if (isConfirmed) {
                bg.setFillStyle(0x002200);
            } else if (isSelected) {
                bg.setFillStyle(0x111133);
            } else if (isHovered) {
                bg.setFillStyle(HOVER_COLOR);
            } else {
                bg.setFillStyle(NORMAL_COLOR);
            }
        });
    }

    private startFight() {
        if (this.confirmed) return;
        
        if (this.mode === "singleplayer" && !this.confirmedP1) return;
        if (this.mode === "multiplayer" && (!this.confirmedP1 || !this.confirmedP2)) return;
        
        this.confirmed = true;
        
        if (this.startButton) {
            this.startButton.destroy();
            this.startButton = null;
        }
        
        const { width, height } = this.scale;

        const fightText = this.add
            .text(width / 2, height / 2, "FIGHT!", {
                fontSize: "72px",
                fontFamily: "Arial Black",
                fontStyle: "bold",
                color: "#ff0000",
                stroke: "#000000",
                strokeThickness: 8,
            })
            .setOrigin(0.5)
            .setDepth(200);

        fightText.setScale(0.5);
        this.tweens.add({
            targets: fightText,
            scale: 1.2,
            duration: 300,
            ease: "Back.easeOut",
            onComplete: () => {
                this.tweens.add({
                    targets: fightText,
                    scale: 1,
                    duration: 200,
                });
            },
        });

        this.time.delayedCall(1500, () => {
            this.scene.start("FightScene", {
                p1Key: CHARACTER_ROSTER[this.selected[0]!].key,
                p2Key:
                    this.mode === "singleplayer"
                        ? CHARACTER_ROSTER[this.selected[0]!].key
                        : CHARACTER_ROSTER[this.selected[1]!].key,
                mode: this.mode,
            });
        });
    }
}