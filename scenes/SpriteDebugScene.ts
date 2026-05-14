// SpriteDebugScene.ts — inspect Ryu-0 / Ryu-1 atlas frames (not a uniform spritesheet).
import Phaser from "phaser";
import { Atlas } from "../atlasUrls";


type RyuCell = { atlas: string; frame: string };

function frameSortKey(frame: string): number {
    const ryu = frame.match(/Ryu_(\d+)/);
    if (ryu) return parseInt(ryu[1], 10);
    const chun = frame.match(/Chun-Li_(\d+)/);
    return chun ? parseInt(chun[1], 10) : 0;
}

/** Thumbnail cap keeps first frame responsive; preview ← → still walks every frame. */
const GRID_THUMB_MAX = 72;

export class SpriteDebugScene extends Phaser.Scene {
    constructor() {
        super({ key: "SpriteDebugScene" });
    }

    preload() {
        // this.load.atlas("Ryu", Atlas.ryu.image, Atlas.ryu.json);
        this.load.atlas("ChunLi", Atlas.chunLi.image, Atlas.chunLi.json);
    }

    create() {
        const { width, height } = this.scale;

        if (!this.textures.exists("ChunLi")) {
            this.add.text(width / 2, height / 2, "Atlas load failed — see console", {
                fontSize: "18px",
                color: "#ff4444",
            }).setOrigin(0.5);
            return;
        }

        const cells: RyuCell[] = [];
        for (const atlasKey of ["ChunLi"] as const) {
            for (const frame of this.textures.get(atlasKey).getFrameNames(false)) {
                if (frame === "__BASE") continue;
                cells.push({ atlas: atlasKey, frame });
            }
        }
        cells.sort((a, b) => frameSortKey(a.frame) - frameSortKey(b.frame));

        const n = this.textures.get("ChunLi").getFrameNames(false).length;
        console.log("=== SPRITE DEBUG (TexturePacker atlases) ===");
        console.log("ChunLi frame count:", n, "| sorted:", cells.length);

        this.add.rectangle(0, 0, width, height, 0x111118).setOrigin(0);

        this.add
            .text(width / 2, 12, "ChunLi atlases — click thumb | ← → full list | ESC → CharacterScene", {
                fontSize: "12px",
                fontFamily: "Arial",    
                color: "#ffdd00",
            })
            .setOrigin(0.5);

        this.add
            .text(
                width / 2,
                28,
                `Thumbs: first ${Math.min(GRID_THUMB_MAX, cells.length)} of ${cells.length} (preview scans all)`,
                { fontSize: "10px", fontFamily: "Arial", color: "#888" }
            )
            .setOrigin(0.5);

        const cols = Math.max(6, Math.floor(width / 56));
        const cell = 52;
        const padX = 8;
        const padY = 44;

        const gridBottom = padY + Math.ceil(Math.min(cells.length, GRID_THUMB_MAX) / cols) * cell + 12;
        const previewY = Math.min(height - 90, Math.max(gridBottom + 40, height * 0.52));

        let testIndex = 0;
        const testSprite = this.add
            .sprite(width / 2, previewY, cells[0].atlas, cells[0].frame)
            .setScale(2.5);

        const label = this.add.text(width / 2, previewY + 88, "", {
            fontSize: "11px",
            fontFamily: "monospace",
            color: "#ffffff",
        }).setOrigin(0.5);

        const applyTest = () => {
            const c = cells[Math.max(0, Math.min(cells.length - 1, testIndex))];
            testSprite.setTexture(c.atlas, c.frame);
            label.setText(`${c.atlas} | ${c.frame}  (${testIndex + 1} / ${cells.length})`);
        };

        const thumbCount = Math.min(cells.length, GRID_THUMB_MAX);
        for (let i = 0; i < thumbCount; i++) {
            const { atlas, frame } = cells[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = padX + col * cell + cell / 2;
            const y = padY + row * cell + cell / 2;
            this.add
                .image(x, y, atlas, frame)
                .setDisplaySize(40, 40)
                .setInteractive({ useHandCursor: true })
                .on("pointerdown", () => {
                    testIndex = i;
                    applyTest();
                });
            this.add
                .text(x, y + cell / 2 - 2, String(frameSortKey(frame)), {
                    fontSize: "8px",
                    color: "#888888",
                })
                .setOrigin(0.5);
        }

        const kb = this.input.keyboard;
        if (kb) {
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT).on("down", () => {
                testIndex = (testIndex - 1 + cells.length) % cells.length;
                applyTest();
            });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT).on("down", () => {
                testIndex = (testIndex + 1) % cells.length;
                applyTest();
            });
            kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
                this.scene.start("CharacterScene");
            });
        }

        applyTest();
    }
}
