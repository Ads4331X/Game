import Phaser from "phaser";
import { CHARACTER_ROSTER, GAMEPLAY_ANIM_IDS, expandFrameRange, GameplayAnimId } from "../characterMoves";

const WALK_SPEED = 200;
const JUMP_VY = -620;
const GRAVITY = 1400;
const HITSTUN_MS = 320;
const INVINCIBLE_MS = 900;
const MAX_ROUNDS = 3;
const MAX_STAMINA = 100;
const STAMINA_REGEN_RATE = 18;
const STAMINA_REGEN_DELAY = 1200;
const MAX_ENERGY = 100;
const ENERGY_ON_HIT = 12;
const ENERGY_ON_RECV = 8;
const SUPER_COST = 100;
const INPUT_BUFFER_MS = 600;
const STAGE_ATLAS = "stage_atlas";

interface AttackDef {
    anim: GameplayAnimId;
    damage: number;
    durationMs: number;
    staminaCost: number;
    energyGain: number;
    hbW: number; hbH: number; hbOffX: number; hbOffY: number;
    activeStart: number; activeEnd: number;
    isSpecial?: boolean;
    knockbackX?: number;
    knockbackY?: number;
}

const ATTACK_MAP: Record<string, AttackDef> = {
    lightPunch:  { anim:"lightPunch",  damage:5,  durationMs:380, staminaCost:6,  energyGain:8,  hbW:90,  hbH:90,  hbOffX:50,  hbOffY:-95,  activeStart:0.15, activeEnd:0.65 },
    mediumPunch: { anim:"mediumPunch", damage:10, durationMs:520, staminaCost:10, energyGain:12, hbW:100, hbH:95,  hbOffX:55,  hbOffY:-100, activeStart:0.15, activeEnd:0.65 },
    heavyPunch:  { anim:"heavyPunch",  damage:17, durationMs:680, staminaCost:16, energyGain:18, hbW:110, hbH:100, hbOffX:60,  hbOffY:-105, activeStart:0.18, activeEnd:0.62 },
    lightKick:   { anim:"lightKick",   damage:6,  durationMs:400, staminaCost:7,  energyGain:9,  hbW:100, hbH:85,  hbOffX:55,  hbOffY:-85,  activeStart:0.15, activeEnd:0.65 },
    mediumKick:  { anim:"mediumKick",  damage:12, durationMs:580, staminaCost:12, energyGain:14, hbW:115, hbH:90,  hbOffX:60,  hbOffY:-90,  activeStart:0.15, activeEnd:0.65 },
    heavyKick:   { anim:"heavyKick",   damage:19, durationMs:730, staminaCost:18, energyGain:20, hbW:120, hbH:95,  hbOffX:65,  hbOffY:-95,  activeStart:0.18, activeEnd:0.62 },
    hadoken:     { anim:"hadoken",     damage:22, durationMs:900, staminaCost:25, energyGain:25, hbW:130, hbH:80,  hbOffX:70,  hbOffY:-90,  activeStart:0.35, activeEnd:0.75, isSpecial:true, knockbackX:380, knockbackY:-200 },
    shoryuken:   { anim:"shoryuken",   damage:28, durationMs:750, staminaCost:30, energyGain:30, hbW:90,  hbH:130, hbOffX:45,  hbOffY:-140, activeStart:0.10, activeEnd:0.55, isSpecial:true, knockbackX:200, knockbackY:-350 },
    tatsumaki:   { anim:"tatsumaki",   damage:20, durationMs:850, staminaCost:28, energyGain:25, hbW:120, hbH:100, hbOffX:60,  hbOffY:-100, activeStart:0.20, activeEnd:0.70, isSpecial:true, knockbackX:300, knockbackY:-150 },
};

type DirInput = "left" | "right" | "up" | "down" | "downLeft" | "downRight";

interface InputEntry {
    dir?: DirInput;
    button?: string;
    t: number;
}

function detectSpecial(buf: InputEntry[], facingRight: boolean, now: number, buttonPressed: string | null): string | null {
    if (!buttonPressed) return null;
    const isPunch = buttonPressed === "LP" || buttonPressed === "MP" || buttonPressed === "HP";
    const isKick  = buttonPressed === "LK" || buttonPressed === "MK" || buttonPressed === "HK";
    const recent = buf.filter(e => e.dir && now - e.t < INPUT_BUFFER_MS).map(e => e.dir!);
    const fwd  = facingRight ? "right" : "left";
    const back = facingRight ? "left"  : "right";
    const fwdDown = facingRight ? "downRight" : "downLeft";

    if (isPunch) {
        const hasQCF = recent.includes("down") && (recent.includes(fwd) || recent.includes(fwdDown)) && recent.lastIndexOf(fwd) > recent.indexOf("down");
        if (hasQCF) return "hadoken";
        const hasDP = recent.includes(fwd) && recent.includes("down") && recent.includes(fwdDown) && recent.lastIndexOf(fwdDown) > recent.indexOf("down");
        if (hasDP) return "shoryuken";
    }
    if (isKick) {
        const hasQCB = recent.includes("down") && (recent.includes(back) || recent.includes(fwdDown)) && recent.lastIndexOf(back) > recent.indexOf("down");
        if (hasQCB) return "tatsumaki";
    }
    return null;
}

class Fighter {
    scene: FightScene;
    sprite: Phaser.Physics.Arcade.Sprite;
    charKey: string;
    atlasKey: string;
    health = 100; maxHealth = 100;
    stamina = MAX_STAMINA; staminaRegenTimer = 0;
    energy = 0; maxEnergy = MAX_ENERGY;
    hitstunTimer = 0; invincibleTimer = 0; attackTimer = 0; attackHitLanded = false;
    isGrounded = false; isAttacking = false; isHit = false; isInvincible = false; isCrouching = false;
    currentAttackId: string | null = null;
    facingRight = true;
    inputBuffer: InputEntry[] = [];

    constructor(scene: FightScene, x: number, facingRight: boolean, charKey: string) {
        this.scene = scene; this.charKey = charKey; this.facingRight = facingRight;
        const entry = CHARACTER_ROSTER.find(c => c.key === charKey)!;
        this.atlasKey = entry.atlasKey;

        this.sprite = scene.physics.add.sprite(x, scene.groundY, entry.atlasKey, entry.portraitFrame)
            .setOrigin(0.5, 1).setScale(2.5).setDepth(5).setCollideWorldBounds(true);

        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(GRAVITY); body.setMaxVelocityY(900);
        body.setSize(70, 115);
        body.setOffset((this.sprite.width - 70) / 2, this.sprite.height - 115);

        this.applyFacing();
        this.play("idle", true);
    }

    applyFacing() { this.sprite.setFlipX(this.facingRight); }

    faceOpponent(other: Fighter) {
        const should = other.sprite.x > this.sprite.x;
        if (should !== this.facingRight) { this.facingRight = should; this.applyFacing(); }
    }

    play(animId: GameplayAnimId, force = false) {
        const key = `${this.charKey}_${animId}`;
        if (!this.scene.anims.exists(key)) return;
        const already = this.sprite.anims.currentAnim?.key === key && this.sprite.anims.isPlaying;
        if (already && !force) return;
        this.sprite.play(key);
    }

    update(dt: number) {
        this.isGrounded = (this.sprite.body as Phaser.Physics.Arcade.Body).blocked.down;
        if (this.invincibleTimer > 0) { this.invincibleTimer -= dt; if (this.invincibleTimer <= 0) this.isInvincible = false; }
        if (this.hitstunTimer > 0) { this.hitstunTimer -= dt; if (this.hitstunTimer <= 0) { this.isHit = false; this.sprite.clearTint(); } }
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = false; this.currentAttackId = null; this.attackHitLanded = false;
                if (this.isGrounded) this.play("idle", true);
            }
        }
        if (this.staminaRegenTimer > 0) this.staminaRegenTimer -= dt;
        else if (this.stamina < MAX_STAMINA) this.stamina = Math.min(MAX_STAMINA, this.stamina + STAMINA_REGEN_RATE * (dt / 1000));
        const now = performance.now();
        this.inputBuffer = this.inputBuffer.filter(e => now - e.t < INPUT_BUFFER_MS);
    }

    hasStamina(cost: number) { return this.stamina >= cost; }
    useStamina(cost: number) { this.stamina = Math.max(0, this.stamina - cost); this.staminaRegenTimer = STAMINA_REGEN_DELAY; }
    gainEnergy(amount: number) { this.energy = Math.min(MAX_ENERGY, this.energy + amount); }
    useEnergy(amount: number) { this.energy = Math.max(0, this.energy - amount); }

    startAttack(id: string) {
        const def = ATTACK_MAP[id]; if (!def) return;
        if (!this.hasStamina(def.staminaCost)) return;
        if (def.isSpecial && this.energy < SUPER_COST) return;
        this.useStamina(def.staminaCost); if (def.isSpecial) this.useEnergy(SUPER_COST);
        this.isAttacking = true; this.currentAttackId = id; this.attackTimer = def.durationMs; this.attackHitLanded = false;
        (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
        this.play(def.anim, true);
    }

    receiveHit(damage: number, knockbackX: number, knockbackY = -150) {
        this.health = Math.max(0, this.health - damage); this.hitstunTimer = HITSTUN_MS; this.attackTimer = 0;
        this.isAttacking = false; this.isHit = true; this.currentAttackId = null;
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocityX(knockbackX); body.setVelocityY(knockbackY);
        this.sprite.setTint(0xffffff);
        this.scene.time.delayedCall(90, () => this.sprite.clearTint());
        this.play("hit", true);
    }

    getHitbox(attackId: string): Phaser.Geom.Rectangle | null {
        const def = ATTACK_MAP[attackId]; if (!def) return null;
        const ox = this.facingRight ? def.hbOffX : -(def.hbOffX + def.hbW);
        return new Phaser.Geom.Rectangle(this.sprite.x + ox, this.sprite.y + def.hbOffY, def.hbW, def.hbH);
    }

    getHurtbox(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(this.sprite.x - 45, this.sprite.y - 130, 90, 130);
    }

    resetForRound(x: number, facingRight: boolean) {
        this.health = 100; this.stamina = MAX_STAMINA; this.energy = 0; this.hitstunTimer = 0;
        this.invincibleTimer = INVINCIBLE_MS; this.attackTimer = 0; this.staminaRegenTimer = 0;
        this.isHit = false; this.isAttacking = false; this.isInvincible = true; this.isCrouching = false;
        this.currentAttackId = null; this.attackHitLanded = false; this.facingRight = facingRight; this.inputBuffer = [];
        (this.sprite.body as Phaser.Physics.Arcade.Body).reset(x, this.scene.groundY);
        this.sprite.clearTint(); this.applyFacing(); this.play("idle", true);
    }

    pushDir(dir: DirInput) { this.inputBuffer.push({ dir, t: performance.now() }); }
    pushButton(button: string) { this.inputBuffer.push({ button, t: performance.now() }); }
}

// ─── STAGE ELEMENT REFERENCES FOR RESIZE ─────────────────────────────
interface StageRefs {
    sky: Phaser.GameObjects.Rectangle;
    stars: Phaser.GameObjects.Graphics;
    stage0?: Phaser.GameObjects.Image;
    stage1?: Phaser.GameObjects.Image;
    stage2: Phaser.GameObjects.Image;
    floor: Phaser.GameObjects.Rectangle;
    stage7?: Phaser.GameObjects.Image;
    ropes: Phaser.GameObjects.Rectangle[];
    posts: { post: Phaser.GameObjects.Rectangle; top: Phaser.GameObjects.Ellipse }[];
    neonLeft?: Phaser.GameObjects.Sprite;
    neonRight?: Phaser.GameObjects.Sprite;
    bunnyLeft?: Phaser.GameObjects.Sprite;
    bunnyRight?: Phaser.GameObjects.Sprite;
    groundLine: Phaser.GameObjects.Rectangle;
}

export default class FightScene extends Phaser.Scene {
    groundY!: number;
    private stageRefs!: StageRefs;  // ← Store all stage elements for resizing
    private scrollOffset = 0;        // ← For parallax auto-scroll
    private p1Key!: string; private p2Key!: string; private mode!: "singleplayer" | "multiplayer";
    private p1!: Fighter; private p2!: Fighter;
    private p1HealthFill!: Phaser.GameObjects.Rectangle; private p2HealthFill!: Phaser.GameObjects.Rectangle;
    private p1StaminaFill!: Phaser.GameObjects.Rectangle; private p2StaminaFill!: Phaser.GameObjects.Rectangle;
    private p1EnergyFill!: Phaser.GameObjects.Rectangle; private p2EnergyFill!: Phaser.GameObjects.Rectangle;
    private p1SuperReady!: Phaser.GameObjects.Text; private p2SuperReady!: Phaser.GameObjects.Text;
    private roundText!: Phaser.GameObjects.Text; private timerText!: Phaser.GameObjects.Text;
    private comboText1!: Phaser.GameObjects.Text; private comboText2!: Phaser.GameObjects.Text;
    private roundNumber = 1; private p1Wins = 0; private p2Wins = 0; private roundTimer = 99;
    private roundTimerEv?: Phaser.Time.TimerEvent; private fightActive = false; private roundEnded = false;
    private p1Combo = 0; private p2Combo = 0;
    private keys!: {
        p1Left: Phaser.Input.Keyboard.Key; p1Right: Phaser.Input.Keyboard.Key;
        p1Up: Phaser.Input.Keyboard.Key; p1Down: Phaser.Input.Keyboard.Key;
        p1LP: Phaser.Input.Keyboard.Key; p1MP: Phaser.Input.Keyboard.Key; p1HP: Phaser.Input.Keyboard.Key;
        p1LK: Phaser.Input.Keyboard.Key; p1MK: Phaser.Input.Keyboard.Key; p1HK: Phaser.Input.Keyboard.Key;
        p2Left: Phaser.Input.Keyboard.Key; p2Right: Phaser.Input.Keyboard.Key;
        p2Up: Phaser.Input.Keyboard.Key; p2Down: Phaser.Input.Keyboard.Key;
        p2LP: Phaser.Input.Keyboard.Key; p2MP: Phaser.Input.Keyboard.Key; p2HP: Phaser.Input.Keyboard.Key;
        p2LK: Phaser.Input.Keyboard.Key; p2MK: Phaser.Input.Keyboard.Key; p2HK: Phaser.Input.Keyboard.Key;
    };
    private p1LastAnim: GameplayAnimId | "" = ""; private p2LastAnim: GameplayAnimId | "" = "";

    constructor() { super({ key: "FightScene" }); }

    init(data: { p1Key: string; p2Key: string; mode: "singleplayer" | "multiplayer" }) {
        this.p1Key = data.p1Key; this.p2Key = data.p2Key; this.mode = data.mode;
        this.roundNumber = 1; this.p1Wins = 0; this.p2Wins = 0;
    }

    preload() {
        this.load.atlas(STAGE_ATLAS, "assets/stage.png", "assets/stage.json");
        for (const key of [this.p1Key, this.p2Key]) {
            const c = CHARACTER_ROSTER.find(r => r.key === key)!;
            if (!this.textures.exists(c.atlasKey)) this.load.atlas(c.atlasKey, c.atlas.image, c.atlas.json);
        }
    }

    create() {
        const { width, height } = this.scale;
        this.groundY = height - 40;

        // Build stage and store references
        this.stageRefs = this.buildStage(width, height);

        // Listen for resize events
        this.scale.on("resize", this.onResize, this);

        this.physics.world.setBounds(60, -600, width - 120, this.groundY + 700);

        const groundGroup = this.physics.add.staticGroup();
        const gb = groundGroup.create(width / 2, this.groundY + 2) as Phaser.Physics.Arcade.Sprite;
        gb.setVisible(false); (gb.body as Phaser.Physics.Arcade.StaticBody).setSize(width, 4); groundGroup.refresh();

        this.registerAnims(this.p1Key);
        if (this.p2Key !== this.p1Key) this.registerAnims(this.p2Key);

        this.p1 = new Fighter(this, width * 0.25, true, this.p1Key);
        this.p2 = new Fighter(this, width * 0.75, false, this.p2Key);
        this.physics.add.collider(this.p1.sprite, groundGroup);
        this.physics.add.collider(this.p2.sprite, groundGroup);

        // Camera setup for parallax feel
        this.cameras.main.setBounds(0, 0, width, height);
        this.cameras.main.setZoom(1);

        this.setupUI(); this.keys = this.buildKeys(); this.setupKeyListeners(); this.startRound();
    }

    // ─── RESIZE HANDLER ─────────────────────────────────────────────────
    private onResize(gameSize: Phaser.Structs.Size) {
        const w = gameSize.width;
        const h = gameSize.height;
        this.groundY = h - 40;

        // Resize camera
        this.cameras.main.setViewport(0, 0, w, h);
        this.cameras.main.setBounds(0, 0, w, h);

        // Update physics bounds
        this.physics.world.setBounds(60, -600, w - 120, this.groundY + 700);

        // Reposition ground collider
        // (Note: static bodies can't easily move, but we recreate or use dynamic positioning in full implementation)

        // Reposition all stage elements
        this.repositionStage(w, h);

        // Reposition fighters if they're off-screen
        if (this.p1 && this.p2) {
            this.p1.sprite.y = Math.min(this.p1.sprite.y, this.groundY);
            this.p2.sprite.y = Math.min(this.p2.sprite.y, this.groundY);
        }

        // Reposition UI
        this.repositionUI(w, h);
    }

    private repositionStage(w: number, h: number) {
        const refs = this.stageRefs;
        refs.sky.setSize(w, h * 0.55);

        // Stars - redraw
        refs.stars.clear();
        refs.stars.fillStyle(0xffffff, 0.8);
        const rng = new Phaser.Math.RandomDataGenerator(["sf2stars"]);
        for (let s = 0; s < 120; s++) {
            refs.stars.fillRect(rng.between(0, w), rng.between(0, h * 0.5), rng.frac() > 0.7 ? 2 : 1, rng.frac() > 0.7 ? 2 : 1);
        }

        // Stage layers - reposition and rescale
        if (refs.stage0) {
            refs.stage0.setPosition(w * 0.5, h * 0.3).setDisplaySize(w * 1.3, h * 0.5);
        }
        if (refs.stage1) {
            refs.stage1.setPosition(w * 0.5, h * 0.42).setDisplaySize(w * 1.1, h * 0.45);
        }

        // ← STAGE 2: Full width, anchored at bottom edge
        refs.stage2.setPosition(w * 0.5, this.groundY - (h * 0.2))
            .setDisplaySize(w, h * 0.4)
            .setOrigin(0.5, 1);  // Anchor to bottom of the image

        // Floor
        refs.floor.setSize(w, h - this.groundY);
        refs.floor.setPosition(0, this.groundY);

        if (refs.stage7) {
            refs.stage7.setPosition(w * 0.5, this.groundY + 30).setDisplaySize(w, 60);
        }

        // Ropes
        const ropeY = [this.groundY - 20, this.groundY - 40, this.groundY - 60];
        refs.ropes.forEach((rope, i) => rope.setPosition(w * 0.5, ropeY[i]).setSize(w * 0.88, 3));

        // Posts
        const postX = [w * 0.08, w * 0.92];
        refs.posts.forEach((p, i) => {
            p.post.setPosition(postX[i], this.groundY - 40);
            p.top.setPosition(postX[i], this.groundY - 82);
        });

        // Neon signs
        if (refs.neonLeft) refs.neonLeft.setPosition(w * 0.18, h * 0.32);
        if (refs.neonRight) refs.neonRight.setPosition(w * 0.82, h * 0.32);
        if (refs.bunnyLeft) refs.bunnyLeft.setPosition(w * 0.35, h * 0.38);
        if (refs.bunnyRight) refs.bunnyRight.setPosition(w * 0.65, h * 0.38);

        // Ground line
        refs.groundLine.setSize(w, 2);
        refs.groundLine.setPosition(0, this.groundY - 1);
    }

    private repositionUI(w: number, h: number) {
        const HW = 280, HY = 28;
        this.p1HealthFill.setPosition(52, HY);
        this.p2HealthFill.setPosition(w - 52, HY);
        this.p1StaminaFill.setPosition(52, 54);
        this.p2StaminaFill.setPosition(w - 52, 54);
        this.p1EnergyFill.setPosition(52, 70);
        this.p2EnergyFill.setPosition(w - 52, 70);
        this.p1SuperReady.setPosition(52 + HW / 2, 84);
        this.p2SuperReady.setPosition((w - 52) - HW / 2, 84);
        this.roundText.setPosition(w / 2, 35);
        this.timerText.setPosition(w / 2, 62);
        this.comboText1.setPosition(200, 180);
        this.comboText2.setPosition(w - 200, 180);
    }

    // ─── STAGE BUILDER (returns refs for resizing) ──────────────────────
    private buildStage(w: number, h: number): StageRefs {
        const sky = this.add.rectangle(0, 0, w, h * 0.55, 0x0d0221).setOrigin(0).setDepth(-20);
        
        const stars = this.add.graphics().setDepth(-19);
        stars.fillStyle(0xffffff, 0.8);
        const rng = new Phaser.Math.RandomDataGenerator(["sf2stars"]);
        for (let s = 0; s < 120; s++) {
            stars.fillRect(rng.between(0, w), rng.between(0, h * 0.5), rng.frac() > 0.7 ? 2 : 1, rng.frac() > 0.7 ? 2 : 1);
        }

        let stage0: Phaser.GameObjects.Image | undefined;
        if (this.textures.get(STAGE_ATLAS).has("balrog-stage-0.png")) {
            stage0 = this.add.image(w * 0.5, h * 0.3, STAGE_ATLAS, "balrog-stage-0.png")
                .setOrigin(0.5).setScrollFactor(0.08).setDepth(-10).setDisplaySize(w * 1.3, h * 0.5);
        }

        let stage1: Phaser.GameObjects.Image | undefined;
        if (this.textures.get(STAGE_ATLAS).has("balrog-stage-1.png")) {
            stage1 = this.add.image(w * 0.5, h * 0.42, STAGE_ATLAS, "balrog-stage-1.png")
                .setOrigin(0.5).setScrollFactor(0.2).setDepth(-8).setDisplaySize(w * 1.1, h * 0.45);
        }

        // ← STAGE 2: Anchored to bottom, full width, origin at bottom
        const stage2 = this.add.image(w * 0.5, this.groundY, STAGE_ATLAS, "balrog-stage-2.png")
            .setOrigin(0.5, 1)  // Bottom-center origin so it sits ON the ground
            .setScrollFactor(0.4)
            .setDepth(-6)
            .setDisplaySize(w, h * 0.4);

        const floor = this.add.rectangle(0, this.groundY, w, h - this.groundY, 0x1a0a2e).setOrigin(0).setDepth(-4);

        let stage7: Phaser.GameObjects.Image | undefined;
        if (this.textures.get(STAGE_ATLAS).has("balrog-stage-7.png")) {
            stage7 = this.add.image(w * 0.5, this.groundY + 30, STAGE_ATLAS, "balrog-stage-7.png")
                .setDisplaySize(w, 60).setDepth(-4).setOrigin(0.5, 0.5);
        }

        const ropeY = [this.groundY - 20, this.groundY - 40, this.groundY - 60];
        const ropeColors = [0xff3333, 0xffffff, 0x4488ff];
        const ropes: Phaser.GameObjects.Rectangle[] = [];
        ropeColors.forEach((color, i) => {
            ropes.push(this.add.rectangle(w * 0.5, ropeY[i], w * 0.88, 3, color).setOrigin(0.5, 0.5).setDepth(-3));
        });

        const posts: { post: Phaser.GameObjects.Rectangle; top: Phaser.GameObjects.Ellipse }[] = [];
        [w * 0.08, w * 0.92].forEach(x => {
            posts.push({
                post: this.add.rectangle(x, this.groundY - 40, 10, 85, 0x666666).setOrigin(0.5, 0.5).setDepth(-3),
                top: this.add.ellipse(x, this.groundY - 82, 16, 10, 0x888888).setDepth(-3)
            });
        });

        let neonLeft: Phaser.GameObjects.Sprite | undefined;
        let neonRight: Phaser.GameObjects.Sprite | undefined;
        if (this.textures.get(STAGE_ATLAS).has("balrog-stage-3.png")) {
            this.createNeonAnim("neon_left", ["balrog-stage-3.png", "balrog-stage-4.png"], 4);
            neonLeft = this.add.sprite(w * 0.18, h * 0.32, STAGE_ATLAS, "balrog-stage-3.png")
                .setDepth(-5).setScrollFactor(0.5).setScale(2).play("neon_left");
            neonRight = this.add.sprite(w * 0.82, h * 0.32, STAGE_ATLAS, "balrog-stage-3.png")
                .setDepth(-5).setScrollFactor(0.5).setScale(2).setFlipX(true).play("neon_left");
        }

        let bunnyLeft: Phaser.GameObjects.Sprite | undefined;
        let bunnyRight: Phaser.GameObjects.Sprite | undefined;
        if (this.textures.get(STAGE_ATLAS).has("balrog-stage-5.png")) {
            this.createNeonAnim("bunny", ["balrog-stage-5.png", "balrog-stage-6.png"], 5);
            bunnyLeft = this.add.sprite(w * 0.35, h * 0.38, STAGE_ATLAS, "balrog-stage-5.png")
                .setDepth(-5).setScrollFactor(0.45).setScale(1.6).play("bunny");
            bunnyRight = this.add.sprite(w * 0.65, h * 0.38, STAGE_ATLAS, "balrog-stage-5.png")
                .setDepth(-5).setScrollFactor(0.45).setScale(1.6).setFlipX(true).play("bunny");
        }

        const groundLine = this.add.rectangle(0, this.groundY - 1, w, 2, 0xaa66ff).setOrigin(0).setDepth(-2);

        return {
            sky, stars, stage0, stage1, stage2, floor, stage7,
            ropes, posts, neonLeft, neonRight, bunnyLeft, bunnyRight, groundLine
        };
    }

    private createNeonAnim(key: string, frames: string[], rate: number) {
        if (!this.anims.exists(key)) {
            this.anims.create({
                key, frames: frames.map(f => ({ key: STAGE_ATLAS, frame: f })),
                frameRate: rate, repeat: -1,
            });
        }
    }

    private registerAnims(charKey: string) {
        const entry = CHARACTER_ROSTER.find(c => c.key === charKey)!;
        for (const animId of GAMEPLAY_ANIM_IDS) {
            const key = `${charKey}_${animId}`;
            if (this.anims.exists(key)) continue;
            const frames = expandFrameRange(entry.gameplayRange(animId), entry.frameName)
                .filter(fn => this.textures.get(entry.atlasKey).has(fn));
            if (frames.length === 0) { console.warn(`No frames: ${key}`); continue; }
            const loop = ["idle", "walkForward", "walkBackward", "crouch"].includes(animId);
            this.anims.create({
                key, frames: frames.map(fn => ({ key: entry.atlasKey, frame: fn })),
                frameRate: animId === "idle" ? 8 : 14, repeat: loop ? -1 : 0,
            });
        }
    }

    private buildKeys() {
        const kb = this.input.keyboard!;
        return {
            p1Left: kb.addKey("A"), p1Right: kb.addKey("D"), p1Up: kb.addKey("W"), p1Down: kb.addKey("S"),
            p1LP: kb.addKey("J"), p1MP: kb.addKey("K"), p1HP: kb.addKey("U"),
            p1LK: kb.addKey("I"), p1MK: kb.addKey("O"), p1HK: kb.addKey("L"),
            p2Left: kb.addKey("LEFT"), p2Right: kb.addKey("RIGHT"), p2Up: kb.addKey("UP"), p2Down: kb.addKey("DOWN"),
            p2LP: kb.addKey("NUMPAD_ONE"), p2MP: kb.addKey("NUMPAD_TWO"), p2HP: kb.addKey("NUMPAD_THREE"),
            p2LK: kb.addKey("NUMPAD_FOUR"), p2MK: kb.addKey("NUMPAD_FIVE"), p2HK: kb.addKey("NUMPAD_SIX"),
        };
    }

    private setupKeyListeners() {
        const push = (f: Fighter, dir: DirInput) => f.pushDir(dir);
        this.input.keyboard!.on("keydown-A", () => push(this.p1, "left"));
        this.input.keyboard!.on("keydown-D", () => push(this.p1, "right"));
        this.input.keyboard!.on("keydown-S", () => push(this.p1, "down"));
        this.input.keyboard!.on("keydown-W", () => push(this.p1, "up"));
        this.input.keyboard!.on("keydown-LEFT", () => push(this.p2, "left"));
        this.input.keyboard!.on("keydown-RIGHT", () => push(this.p2, "right"));
        this.input.keyboard!.on("keydown-DOWN", () => push(this.p2, "down"));
        this.input.keyboard!.on("keydown-UP", () => push(this.p2, "up"));
    }

    private setupUI() {
        const { width } = this.scale;
        const HW = 280, HH = 20, HY = 28;
        this.add.rectangle(52, HY, HW, HH, 0x1a0000).setOrigin(0).setDepth(100);
        this.add.rectangle(width - 52, HY, HW, HH, 0x1a0000).setOrigin(1, 0).setDepth(100);
        this.p1HealthFill = this.add.rectangle(52, HY, HW, HH, 0x22dd22).setOrigin(0).setDepth(101);
        this.p2HealthFill = this.add.rectangle(width - 52, HY, HW, HH, 0x22dd22).setOrigin(1, 0).setDepth(101);
        this.add.rectangle(52, HY, HW, HH).setOrigin(0).setStrokeStyle(2, 0xffffff, 0.6).setDepth(102);
        this.add.rectangle(width - 52, HY, HW, HH).setOrigin(1, 0).setStrokeStyle(2, 0xffffff, 0.6).setDepth(102);

        const SW = 280, SH = 10, SY = 54;
        this.add.rectangle(52, SY, SW, SH, 0x1a1a00).setOrigin(0).setDepth(100);
        this.add.rectangle(width - 52, SY, SW, SH, 0x1a1a00).setOrigin(1, 0).setDepth(100);
        this.p1StaminaFill = this.add.rectangle(52, SY, SW, SH, 0xffdd00).setOrigin(0).setDepth(101);
        this.p2StaminaFill = this.add.rectangle(width - 52, SY, SW, SH, 0xffdd00).setOrigin(1, 0).setDepth(101);

        const EW = 280, EH = 10, EY = 70;
        this.add.rectangle(52, EY, EW, EH, 0x00001a).setOrigin(0).setDepth(100);
        this.add.rectangle(width - 52, EY, EW, EH, 0x00001a).setOrigin(1, 0).setDepth(100);
        this.p1EnergyFill = this.add.rectangle(52, EY, 0, EH, 0x00aaff).setOrigin(0).setDepth(101);
        this.p2EnergyFill = this.add.rectangle(width - 52, EY, 0, EH, 0x00aaff).setOrigin(1, 0).setDepth(101);

        this.p1SuperReady = this.add.text(52 + EW / 2, EY + 14, "★ SUPER READY!", { fontSize: "11px", fontFamily: "Arial Black", color: "#00ffff" }).setOrigin(0.5).setDepth(102).setVisible(false);
        this.p2SuperReady = this.add.text((width - 52) - EW / 2, EY + 14, "★ SUPER READY!", { fontSize: "11px", fontFamily: "Arial Black", color: "#00ffff" }).setOrigin(0.5).setDepth(102).setVisible(false);

        const n1 = CHARACTER_ROSTER.find(c => c.key === this.p1Key)?.displayName ?? "P1";
        const n2 = CHARACTER_ROSTER.find(c => c.key === this.p2Key)?.displayName ?? "P2";
        this.add.text(55, HY - 2, n1, { fontSize: "14px", fontFamily: "Arial Black", color: "#44aaff", stroke: "#000", strokeThickness: 3 }).setOrigin(0).setDepth(103);
        this.add.text(width - 55, HY - 2, n2, { fontSize: "14px", fontFamily: "Arial Black", color: "#ff6644", stroke: "#000", strokeThickness: 3 }).setOrigin(1, 0).setDepth(103);

        this.roundText = this.add.text(width / 2, 35, "ROUND 1", { fontSize: "22px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(100).setVisible(false);
        this.timerText = this.add.text(width / 2, 62, "99", { fontSize: "28px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(100);

        this.comboText1 = this.add.text(200, 180, "", { fontSize: "32px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setVisible(false).setDepth(100);
        this.comboText2 = this.add.text(width - 200, 180, "", { fontSize: "32px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setVisible(false).setDepth(100);

        this.add.text(width / 2, this.scale.height - 12, "P1: WASD=move | J=LP K=MP U=HP | I=LK O=MK L=HK | Special: ↓→+punch / →↓↘+punch / ↓←+kick", { fontSize: "9px", color: "#666666" }).setOrigin(0.5, 1).setDepth(50);
    }

    private startRound() {
        const { width } = this.scale;
        this.roundEnded = false; this.fightActive = false; this.roundTimer = 99;
        this.p1Combo = 0; this.p2Combo = 0; this.p1LastAnim = ""; this.p2LastAnim = "";

        this.p1.resetForRound(width * 0.25, true);
        this.p2.resetForRound(width * 0.75, false);
        this.updateAllBars();

        this.roundText.setText(`ROUND ${this.roundNumber}`).setVisible(true);
        const fightText = this.add.text(width / 2, this.scale.height / 2 - 40, "FIGHT!", { fontSize: "80px", fontFamily: "Arial Black", color: "#ff0000", stroke: "#000", strokeThickness: 10 }).setOrigin(0.5).setDepth(200).setVisible(false).setScale(0.3);

        this.time.delayedCall(1800, () => {
            this.roundText.setVisible(false); fightText.setVisible(true);
            this.tweens.add({ targets: fightText, scale: 1.1, duration: 350, ease: "Back.easeOut", onComplete: () => this.tweens.add({ targets: fightText, alpha: 0, scale: 1.3, duration: 500, onComplete: () => fightText.destroy() }) });
            this.fightActive = true;
            this.roundTimerEv = this.time.addEvent({ delay: 1000, loop: true, callbackScope: this, callback: () => { this.roundTimer--; this.timerText.setText(String(this.roundTimer)); if (this.roundTimer <= 0) this.endRound("timeout"); } });
        });
    }

    private endRound(result: "p1" | "p2" | "timeout") {
        if (this.roundEnded) return;
        this.roundEnded = true; this.fightActive = false; this.roundTimerEv?.destroy();
        if (result === "timeout") result = this.p1.health >= this.p2.health ? "p1" : "p2";
        if (result === "p1") this.p1Wins++; else this.p2Wins++;
        const label = result === "p1" ? "P1 WINS!" : (this.mode === "singleplayer" ? "CPU WINS!" : "P2 WINS!");
        const txt = this.add.text(this.scale.width / 2, this.scale.height / 2, label, { fontSize: "52px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 6 }).setOrigin(0.5).setDepth(200);
        this.tweens.add({ targets: txt, scale: { from: 0.4, to: 1 }, duration: 450, ease: "Back.easeOut" });
        const matchOver = this.p1Wins >= Math.ceil(MAX_ROUNDS / 2) || this.p2Wins >= Math.ceil(MAX_ROUNDS / 2);
        this.time.delayedCall(3000, () => { txt.destroy(); if (matchOver) this.endMatch(result as "p1" | "p2"); else { this.roundNumber++; this.startRound(); } });
    }

    private endMatch(winner: "p1" | "p2") {
        const key = winner === "p1" ? this.p1Key : this.p2Key;
        const name = CHARACTER_ROSTER.find(c => c.key === key)?.displayName ?? winner.toUpperCase();
        this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, `${name} WINS THE MATCH!`, { fontSize: "48px", fontFamily: "Arial Black", color: "#ffdd00", stroke: "#000", strokeThickness: 8 }).setOrigin(0.5).setDepth(200);
        this.add.text(this.scale.width / 2, this.scale.height / 2 + 40, "Press ENTER to return", { fontSize: "20px", fontFamily: "Arial", color: "#aaaaaa" }).setOrigin(0.5).setDepth(200);
        this.input.keyboard!.once("keydown-ENTER", () => this.scene.start("CharacterScene", { mode: this.mode }));
    }

    update(_time: number, delta: number) {
        const dt = delta;
        this.autoFaceBoth();
        this.p1.update(dt); this.p2.update(dt);
        
        // ← Subtle parallax auto-scroll for "movable" stage feel
        this.scrollOffset += dt * 0.02;
        const w = this.scale.width;
        const parallaxX = Math.sin(this.scrollOffset * 0.001) * 20;
        this.cameras.main.setScroll(parallaxX, 0);
        
        if (!this.fightActive || this.roundEnded) return;
        this.processInput(this.p1, true);
        if (this.mode === "multiplayer") this.processInput(this.p2, false);
        else this.processAI(this.p2, this.p1);
        this.checkHits();
        this.updateAllBars();
        if (this.p1.health <= 0) this.endRound("p2");
        else if (this.p2.health <= 0) this.endRound("p1");
    }

    private autoFaceBoth() {
        if (!this.p1 || !this.p2) return;
        const p1OnLeft = this.p1.sprite.x < this.p2.sprite.x;
        if (this.p1.facingRight !== p1OnLeft) { this.p1.facingRight = p1OnLeft; this.p1.applyFacing(); }
        const p2FaceRight = !p1OnLeft;
        if (this.p2.facingRight !== p2FaceRight) { this.p2.facingRight = p2FaceRight; this.p2.applyFacing(); }
    }

    private processInput(f: Fighter, isP1: boolean) {
        if (f.hitstunTimer > 0) return;
        const k = this.keys;
        const left = isP1 ? k.p1Left : k.p2Left;
        const right = isP1 ? k.p1Right : k.p2Right;
        const up = isP1 ? k.p1Up : k.p2Up;
        const down = isP1 ? k.p1Down : k.p2Down;
        const lpKey = isP1 ? k.p1LP : k.p2LP;
        const mpKey = isP1 ? k.p1MP : k.p2MP;
        const hpKey = isP1 ? k.p1HP : k.p2HP;
        const lkKey = isP1 ? k.p1LK : k.p2LK;
        const mkKey = isP1 ? k.p1MK : k.p2MK;
        const hkKey = isP1 ? k.p1HK : k.p2HK;

        const body = f.sprite.body as Phaser.Physics.Arcade.Body;
        const JD = Phaser.Input.Keyboard.JustDown;

        const goLeft = left.isDown && !right.isDown;
        const goRight = right.isDown && !left.isDown;
        const goDown = down.isDown;

        if (goDown && goRight) f.pushDir("downRight");
        else if (goDown && goLeft) f.pushDir("downLeft");

        let pressedBtn: string | null = null;
        if (JD(lpKey)) pressedBtn = "LP";
        else if (JD(mpKey)) pressedBtn = "MP";
        else if (JD(hpKey)) pressedBtn = "HP";
        else if (JD(lkKey)) pressedBtn = "LK";
        else if (JD(mkKey)) pressedBtn = "MK";
        else if (JD(hkKey)) pressedBtn = "HK";

        if (f.isGrounded && !f.isAttacking && pressedBtn) {
            const special = detectSpecial(f.inputBuffer, f.facingRight, performance.now(), pressedBtn);
            if (special && f.energy >= SUPER_COST && f.hasStamina(ATTACK_MAP[special].staminaCost)) {
                f.startAttack(special); this.showSpecialBanner(isP1, special); return;
            }

            const btnToAttack: Record<string, string> = {
                "LP": "lightPunch", "MP": "mediumPunch", "HP": "heavyPunch",
                "LK": "lightKick", "MK": "mediumKick", "HK": "heavyKick"
            };
            const attackId = btnToAttack[pressedBtn];
            if (attackId) { f.startAttack(attackId); return; }
        }

        if (f.isAttacking) return;

        if (goDown && f.isGrounded) { body.setVelocityX(0); f.isCrouching = true; this.setAnim(f, isP1, "crouch"); return; }
        f.isCrouching = false;

        if (JD(up) && f.isGrounded) {
            const jvx = goLeft ? -WALK_SPEED : goRight ? WALK_SPEED : 0;
            body.setVelocityX(jvx); body.setVelocityY(JUMP_VY);
            this.setAnim(f, isP1, "jump");
            return;
        }

        if (goLeft) body.setVelocityX(-WALK_SPEED);
        else if (goRight) body.setVelocityX(WALK_SPEED);
        else body.setVelocityX(0);

        if (f.isGrounded) {
            if (goLeft || goRight) {
                const toward = (goRight && f.facingRight) || (goLeft && !f.facingRight);
                const walkAnim: GameplayAnimId = toward ? "walkForward" : "walkBackward";
                this.setAnim(f, isP1, walkAnim);
            } else {
                this.setAnim(f, isP1, "idle");
            }
        }
    }

    private setAnim(f: Fighter, isP1: boolean, animId: GameplayAnimId) {
        const last = isP1 ? this.p1LastAnim : this.p2LastAnim;
        if (last === animId) return;
        f.play(animId, true);
        if (isP1) this.p1LastAnim = animId; else this.p2LastAnim = animId;
    }

    private showSpecialBanner(isP1: boolean, specialId: string) {
        const { width } = this.scale;
        const names: Record<string, string> = { hadoken: "HADOKEN!", shoryuken: "SHORYUKEN!", tatsumaki: "TATSUMAKI!" };
        const label = names[specialId] ?? "SPECIAL!";
        const x = isP1 ? 200 : width - 200;
        const banner = this.add.text(x, 250, label, { fontSize: "28px", fontFamily: "Arial Black", color: "#00ffff", stroke: "#000055", strokeThickness: 5 }).setOrigin(0.5).setDepth(200).setScale(0.5);
        this.tweens.add({ targets: banner, scale: 1.4, duration: 250, ease: "Back.easeOut" });
        this.tweens.add({ targets: banner, alpha: 0, scale: 1.8, delay: 700, duration: 400, onComplete: () => banner.destroy() });
    }

    private processAI(ai: Fighter, player: Fighter) {
        if (ai.hitstunTimer > 0 || ai.isAttacking) return;
        const body = ai.sprite.body as Phaser.Physics.Arcade.Body;
        const dist = Math.abs(ai.sprite.x - player.sprite.x);
        const roll = Math.random();
        if (dist < 200 && ai.energy >= SUPER_COST && roll < 0.15 && ai.isGrounded) {
            const specials = ["hadoken", "shoryuken"];
            ai.startAttack(specials[Math.floor(Math.random() * specials.length)]); return;
        }
        if (dist < 130 && roll < 0.45 && ai.isGrounded) {
            const ids = ["lightPunch", "mediumPunch", "lightKick", "mediumKick"];
            ai.startAttack(ids[Math.floor(Math.random() * ids.length)]);
        } else if (dist > 220) {
            body.setVelocityX(ai.facingRight ? WALK_SPEED * 0.65 : -WALK_SPEED * 0.65);
            if (ai.isGrounded) ai.play("walkForward");
        } else if (dist < 80 && roll < 0.3) {
            body.setVelocityX(ai.facingRight ? -WALK_SPEED * 0.5 : WALK_SPEED * 0.5);
            if (ai.isGrounded) ai.play("walkBackward");
        } else {
            body.setVelocityX(0); if (ai.isGrounded) ai.play("idle");
        }
    }

    private checkHits() { this.tryHit(this.p1, this.p2, 1); this.tryHit(this.p2, this.p1, 2); }

    private tryHit(attacker: Fighter, defender: Fighter, side: 1 | 2) {
        if (!attacker.isAttacking || attacker.attackHitLanded || !attacker.currentAttackId) return;
        if (defender.isInvincible || defender.hitstunTimer > 0) return;
        const def = ATTACK_MAP[attacker.currentAttackId];
        const elapsed = def.durationMs - attacker.attackTimer;
        if (elapsed < def.durationMs * def.activeStart || elapsed > def.durationMs * def.activeEnd) return;
        const hitbox = attacker.getHitbox(attacker.currentAttackId);
        const hurtbox = defender.getHurtbox();
        if (!hitbox || !Phaser.Geom.Rectangle.Overlaps(hitbox, hurtbox)) return;

        attacker.attackHitLanded = true;
        attacker.gainEnergy(def.energyGain); defender.gainEnergy(ENERGY_ON_RECV);
        const kx = (def.knockbackX ?? 280) * (attacker.facingRight ? 1 : -1);
        const ky = def.knockbackY ?? -150;
        defender.receiveHit(def.damage, kx, ky);

        if (side === 1) { this.p1Combo++; this.showCombo(this.comboText1, this.p1Combo); }
        else { this.p2Combo++; this.showCombo(this.comboText2, this.p2Combo); }

        const spark = this.add.ellipse(defender.sprite.x + (attacker.facingRight ? 30 : -30), defender.sprite.y - 80, 50, 50, def.isSpecial ? 0x00ffff : 0xffff00).setDepth(50);
        this.tweens.add({ targets: spark, scaleX: 3, scaleY: 3, alpha: 0, duration: 160, onComplete: () => spark.destroy() });
        this.cameras.main.shake(def.isSpecial ? 160 : 80, def.isSpecial ? 0.022 : 0.012);
    }

    private showCombo(text: Phaser.GameObjects.Text, count: number) {
        if (count < 2) return;
        text.setText(`${count} HITS!`).setVisible(true).setAlpha(1).setScale(1.6);
        this.tweens.killTweensOf(text);
        this.tweens.add({ targets: text, scale: 1, duration: 200, ease: "Back.easeOut" });
        this.tweens.add({ targets: text, alpha: 0, delay: 1000, duration: 300, onComplete: () => text.setVisible(false) });
    }

    private updateAllBars() {
        const HW = 280, SW = 280, EW = 280;
        const p1hp = this.p1.health / this.p1.maxHealth; const p2hp = this.p2.health / this.p2.maxHealth;
        this.p1HealthFill.setSize(Math.max(0, p1hp * HW), 20); this.p2HealthFill.setSize(Math.max(0, p2hp * HW), 20);
        this.p1HealthFill.setFillStyle(p1hp > 0.5 ? 0x22dd22 : p1hp > 0.25 ? 0xffaa00 : 0xff2222);
        this.p2HealthFill.setFillStyle(p2hp > 0.5 ? 0x22dd22 : p2hp > 0.25 ? 0xffaa00 : 0xff2222);
        const p1st = this.p1.stamina / MAX_STAMINA; const p2st = this.p2.stamina / MAX_STAMINA;
        this.p1StaminaFill.setSize(Math.max(0, p1st * SW), 10); this.p2StaminaFill.setSize(Math.max(0, p2st * SW), 10);
        const p1en = this.p1.energy / MAX_ENERGY; const p2en = this.p2.energy / MAX_ENERGY;
        this.p1EnergyFill.setSize(Math.max(0, p1en * EW), 10); this.p2EnergyFill.setSize(Math.max(0, p2en * EW), 10);
        const p1full = this.p1.energy >= SUPER_COST; const p2full = this.p2.energy >= SUPER_COST;
        this.p1EnergyFill.setFillStyle(p1full ? 0x00ffff : 0x0088ff); this.p2EnergyFill.setFillStyle(p2full ? 0x00ffff : 0x0088ff);
        this.p1SuperReady.setVisible(p1full); this.p2SuperReady.setVisible(p2full);
    }
}