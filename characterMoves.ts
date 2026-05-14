/**
 * Character atlases: one place for move → sprite index ranges and roster metadata.
 */
import { Atlas } from "./atlasUrls";

export type FrameRange = readonly [start: number, end: number];

export type GameplayAnimId =
    | "idle"
    | "crouch"
    | "jump"
    | "walkForward"
    | "walkBackward"
    | "lightPunch"
    | "mediumPunch"
    | "heavyPunch"
    | "lightKick"
    | "mediumKick"
    | "heavyKick"
    | "hadoken"
    | "shoryuken"
    | "tatsumaki"
    | "hit"
    | "fall"
    | "victory"
    | "battleStart";

export const GAMEPLAY_ANIM_IDS = [
    "idle", "crouch", "jump", "walkForward", "walkBackward",
    "lightPunch", "mediumPunch", "heavyPunch",
    "lightKick", "mediumKick", "heavyKick",
    "hadoken", "shoryuken", "tatsumaki",
    "hit", "fall", "victory", "battleStart",
] as const satisfies readonly GameplayAnimId[];

export function expandFrameRange(
    range: FrameRange,
    frameName: (index: number) => string
): string[] {
    const [a, b] = range;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const names: string[] = [];
    for (let i = lo; i <= hi; i++) names.push(frameName(i));
    return names;
}

// ═════════════════════════════════════════════════════════════════════════════
// RYU (unchanged)
// ═════════════════════════════════════════════════════════════════════════════

export const ryuFrameName = (index: number) => `Ryu_${index}.png`;

export const ryuSheet = {
    idle: [128, 134],
    crouch: [135, 135],
    jump: [153, 162],
    run: [196, 202],
    rollLeft: [216, 225],
    punch: [343, 347],
    powerPunch: [347, 356],
    hardPunch: [442, 453],
    kick: [356, 363],
    powerKick: [333, 342],
    tornadoKick: [364, 373],
    hadoken: [514, 526],
    uppercut: [316, 325],
    tornadoSkyKick: [538, 555],
    gotHit: [235, 239],
    fallByHit: [633, 643],
    victory: [269, 287],
    battleStart: [256, 269],
} as const;

export type RyuSheetKey = keyof typeof ryuSheet;

export const ryuGameplaySheetKey: Record<GameplayAnimId, RyuSheetKey> = {
    idle: "idle",
    crouch: "crouch",
    jump: "jump",
    walkForward: "run",
    walkBackward: "rollLeft",
    lightPunch: "punch",
    mediumPunch: "powerPunch",
    heavyPunch: "hardPunch",
    lightKick: "kick",
    mediumKick: "powerKick",
    heavyKick: "tornadoKick",
    hadoken: "hadoken",
    shoryuken: "uppercut",
    tatsumaki: "tornadoSkyKick",
    hit: "gotHit",
    fall: "fallByHit",
    victory: "victory",
    battleStart: "battleStart",
};

export function ryuGameplayRange(anim: GameplayAnimId): FrameRange {
    return ryuSheet[ryuGameplaySheetKey[anim]];
}

// ═════════════════════════════════════════════════════════════════════════════
// CHUN-LI — Same structure as Ryu (numbered frames in atlas)
// ═════════════════════════════════════════════════════════════════════════════

export const chunLiFrameName = (index: number) => `Chun-Li/Chun-Li_${index}.png`;

/** Chun-Li sheet — using same pattern as ryuSheet */
export const chunLiSheet = {
    idle: [75, 83],
    crouch: [136, 136],        // Placeholder — reuse idle if no crouch found
    jump: [143, 155],           // forwardJump
    run: [196, 202],            // Placeholder — reuse idle for now
    rollLeft: [216, 225],       // Placeholder
    punch: [343, 347],          // Placeholder
    powerPunch: [347, 356],     // Placeholder
    hardPunch: [442, 453],       // Placeholder
    kick: [356, 363],            // Placeholder
    powerKick: [333, 342],       // Placeholder
    tornadoKick: [364, 373],     // Placeholder
    hadoken: [514, 526],         // Placeholder
    uppercut: [316, 325],        // Placeholder
    tornadoSkyKick: [538, 555],   // Placeholder
    gotHit: [235, 239],          // Placeholder
    fallByHit: [633, 643],       // Placeholder
    victory: [317, 345],         // victory2
    battleStart: [286, 308],      // gameStartPose
} as const;

export type ChunLiSheetKey = keyof typeof chunLiSheet;

/** Map gameplay anims to Chun-Li sheet keys — same pattern as Ryu */
export const chunLiGameplaySheetKey: Record<GameplayAnimId, ChunLiSheetKey> = {
    idle: "idle",
    crouch: "crouch",
    jump: "jump",
    walkForward: "run",
    walkBackward: "rollLeft",
    lightPunch: "punch",
    mediumPunch: "powerPunch",
    heavyPunch: "hardPunch",
    lightKick: "kick",
    mediumKick: "powerKick",
    heavyKick: "tornadoKick",
    hadoken: "hadoken",
    shoryuken: "uppercut",
    tatsumaki: "tornadoSkyKick",
    hit: "gotHit",
    fall: "fallByHit",
    victory: "victory",
    battleStart: "battleStart",
};

export function chunLiGameplayRange(anim: GameplayAnimId): FrameRange {
    return chunLiSheet[chunLiGameplaySheetKey[anim]];
}

// ═════════════════════════════════════════════════════════════════════════════
// KEN — Same structure as Ryu (numbered frames in atlas, for testing)
// ═════════════════════════════════════════════════════════════════════════════

export const kenFrameName = (index: number) => `Ken Masters_${index}.png`;

/** Ken sheet — using same pattern as ryuSheet (placeholder ranges for testing) */
export const kenSheet = {
    idle: [75, 83],
    crouch: [136, 136],        // Placeholder — reuse idle if no crouch found
    jump: [143, 155],           // forwardJump
    run: [196, 202],            // Placeholder — reuse idle for now
    rollLeft: [216, 225],       // Placeholder
    punch: [343, 347],          // Placeholder
    powerPunch: [347, 356],     // Placeholder
    hardPunch: [442, 453],       // Placeholder
    kick: [356, 363],            // Placeholder
    powerKick: [333, 342],       // Placeholder
    tornadoKick: [364, 373],     // Placeholder
    hadoken: [514, 526],         // Placeholder
    uppercut: [316, 325],        // Placeholder
    tornadoSkyKick: [538, 555],   // Placeholder
    gotHit: [235, 239],          // Placeholder
    fallByHit: [633, 643],       // Placeholder
    victory: [317, 345],         // victory2
    battleStart: [286, 308],      // gameStartPose
} as const;

export type KenSheetKey = keyof typeof kenSheet;

/** Map gameplay anims to Ken sheet keys — same pattern as Ryu */
export const kenGameplaySheetKey: Record<GameplayAnimId, KenSheetKey> = {
    idle: "idle",
    crouch: "crouch",
    jump: "jump",
    walkForward: "run",
    walkBackward: "rollLeft",
    lightPunch: "punch",
    mediumPunch: "powerPunch",
    heavyPunch: "hardPunch",
    lightKick: "kick",
    mediumKick: "powerKick",
    heavyKick: "tornadoKick",
    hadoken: "hadoken",
    shoryuken: "uppercut",
    tatsumaki: "tornadoSkyKick",
    hit: "gotHit",
    fall: "fallByHit",
    victory: "victory",
    battleStart: "battleStart",
};

export function kenGameplayRange(anim: GameplayAnimId): FrameRange {
    return kenSheet[kenGameplaySheetKey[anim]];
}

// ═════════════════════════════════════════════════════════════════════════════
// ROSTER
// ═════════════════════════════════════════════════════════════════════════════

export interface CharacterRosterEntry {
    key: string;
    displayName: string;
    atlasKey: string;
    atlas: { image: string; json: string };
    portraitFrame: string;
    portraitPfp: { loaderKey: string; url: string } | null;
    frameName: (index: number) => string;
    gameplayRange: (anim: GameplayAnimId) => FrameRange;
}

const ryuPfpUrl = new URL("./assets/fighters/ryu-pfp.png", import.meta.url).href;
const chunLiPfpUrl = new URL("./assets/fighters/chunLi-pfp.png", import.meta.url).href;
const kenPfpUrl = new URL("./assets/fighters/ken-pfp.png", import.meta.url).href;

export const CHARACTER_ROSTER: readonly CharacterRosterEntry[] = [
    {
        key: "ryu",
        displayName: "RYU",
        atlasKey: "Ryu",
        atlas: Atlas.ryu,
        portraitFrame: "Ryu_129.png",
        portraitPfp: { loaderKey: "ryu-pfp", url: ryuPfpUrl },
        frameName: ryuFrameName,
        gameplayRange: ryuGameplayRange,
    },
    {
        key: "chunLi",
        displayName: "CHUN-LI",
        atlasKey: "ChunLi",
        atlas: Atlas.chunLi,
        portraitFrame: "Chun-Li/Chun-Li_75.png",
        portraitPfp: { loaderKey: "chunLi-pfp", url: chunLiPfpUrl },
        frameName: chunLiFrameName,
        gameplayRange: chunLiGameplayRange,
    },
    {
        key: "ken",
        displayName: "KEN",
        atlasKey: "Ken",
        atlas: Atlas.ken,
        portraitFrame: "Ken Masters_0.png",
        portraitPfp: { loaderKey: "ken-pfp", url: kenPfpUrl },
        frameName: kenFrameName,
        gameplayRange: kenGameplayRange,
    },
];

export function rosterEntryByKey(key: string): CharacterRosterEntry | undefined {
    return CHARACTER_ROSTER.find((c) => c.key === key);
}