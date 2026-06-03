const TILE_SIZE = 16;

const IMAGES = {
    MAIN: 'assets/chara_set.png',
    COLOR_OBJ: 'assets/chara_irokomono2.png',
    HEARTS: 'assets/chara_set_tsuika.png',
    WALL_COL: 'assets/chara_set_tsuika2.png',
    EFFECTS: 'assets/chara_set2.png',
    YUKA: 'assets/yuka.png',
    YUKA1: 'assets/yuka1.png',
    YUKA2: 'assets/yuka2.png',
    YUKA3: 'assets/yuka3.png',
    YUKA4: 'assets/yuka4.png',
    YUKA5: 'assets/yuka5.png',
    YUKA6: 'assets/yuka6.png',
    VARIANTS: 'assets/chara_irokomono.png',
    TRIGGERS: 'assets/chara_irohenka.png',
    WALL_3: 'assets/chara_set_tsuika3.png',
    WALL_4: 'assets/chara_set_tsuika4.png',
    SIGHT_COOKIE: 'assets/sunlight.png'
};

function grid(row, col) {
    return { x: col * TILE_SIZE, y: row * TILE_SIZE };
}

function pos(h, col, row) {
    return { x: col * TILE_SIZE, y: h - (row + 1) * TILE_SIZE };
}

const WALL_IMAGE_HEIGHT = {
    MAIN: 256,
    WALL_COL: 64,
    WALL_3: 240,
    WALL_4: 16
};

const TORCH_THEME_COLS = {
    0: 0,
    1: 3,
    2: 6,
    3: 9,
    4: 12,
    5: 15,
    6: 18
};

const WALL_MAPPING = {
    0: { r: 6, c: 1 },
    1: { r: 3, c: 2 },
    2: { r: 4, c: 2 },
    3: { r: 5, c: 1 },
    4: { r: 6, c: 2 },
    5: { r: 6, c: 0 },
    6: { r: 7, c: 1 },
    7: { r: 4, c: 1 },
    8: { r: 4, c: 0 },
    9: { r: 3, c: 1 },
    10: { r: 3, c: 0 },
    11: { r: 7, c: 2 },
    12: { r: 7, c: 0 },
    13: { r: 5, c: 0 },
    14: { r: 5, c: 2 },
    15: { img: 'WALL_COL', r: 2, c: 2 },
    16: { img: 'WALL_COL', r: 2, c: 1 },
    17: { img: 'WALL_COL', r: 3, c: 1 },
    18: { img: 'WALL_COL', r: 0, c: 2 },
    19: { img: 'WALL_COL', r: 3, c: 2 },
    20: { img: 'WALL_COL', r: 2, c: 0 },
    21: { img: 'WALL_COL', r: 1, c: 2 },
    22: { img: 'WALL_COL', r: 0, c: 0 },
    23: { img: 'WALL_COL', r: 1, c: 1 },
    24: { img: 'WALL_COL', r: 1, c: 0 },
    25: { img: 'WALL_COL', r: 0, c: 1 },
    26: { r: 1, c: 2 },
    27: { img: 'WALL_4', colsPerColor: 2, r: 0, c: 0 },
    28: { img: 'WALL_4', colsPerColor: 2, r: 0, c: 1 },
    29: { img: 'WALL_3', r: 0, c: 0 },
    30: { img: 'WALL_3', r: 0, c: 1 },
    31: { img: 'WALL_3', r: 0, c: 2 },
    32: { img: 'WALL_3', r: 1, c: 0 },
    33: { img: 'WALL_3', r: 1, c: 1 },
    34: { img: 'WALL_3', r: 3, c: 0 },
    35: { img: 'WALL_3', r: 3, c: 2 },
    36: { img: 'WALL_3', r: 7, c: 0 },
    37: { img: 'WALL_3', r: 5, c: 0 },
    38: { img: 'WALL_3', r: 10, c: 0 },
    39: { img: 'WALL_3', r: 10, c: 2 },
    40: { img: 'WALL_3', r: 5, c: 2 },
    41: { img: 'WALL_3', r: 8, c: 1 },
    42: { img: 'WALL_3', r: 9, c: 1 },
    43: { img: 'WALL_3', r: 11, c: 1 },
    44: { img: 'WALL_3', r: 12, c: 1 },
    45: { img: 'WALL_3', r: 13, c: 0 },
    46: { img: 'WALL_3', r: 13, c: 2 },
    47: { img: 'WALL_3', r: 14, c: 1 },
    48: { img: 'WALL_3', r: 6, c: 1 },
    49: { img: 'WALL_3', r: 7, c: 2 }
};

const SPRITE_CONFIG = {
    HEROINE: {
        getSprite: (form, dir, tick) => {
            const row = tick > 45 ? 1 : 0;
            let col = 0;
            if (form === 1) col = (dir === DIR.LEFT) ? 1 : 0;
            else col = (dir === DIR.LEFT) ? 3 : 2;
            return { img: IMAGES.MAIN, ...grid(row, col) };
        }
    },

    ENEMIES: {
        SIMPLE: {
            getSprite: (id, tick) => {
                const row = tick > 45 ? 1 : 0;
                return { img: IMAGES.MAIN, ...grid(row, (id - 11) + 4) };
            }
        },
        COLOR: {
            getSprite: (id, colorTheme, tick) => {
                const row = tick > 30 ? 1 : 0;
                let col = 0;
                if (id === 16) col = colorTheme;
                else if (id === 21) col = 1;
                else if (id === 22) col = 2;
                else if (id === 23) col = 3;
                else if (id === 24) col = 4;
                else if (id === 25) col = 6;
                else if (id === 26) col = 0;
                return { img: IMAGES.VARIANTS, ...grid(row, col) };
            }
        }
    },

    BOXES: {
        getSprite: (colorTheme) => {
            const col = (colorTheme - 1) || 0;
            return { img: IMAGES.COLOR_OBJ, ...grid(2, col) };
        }
    },

    HEARTS: {
        getSprite: (id, tick) => {
            const frame = Math.floor(tick / 20) % 3;
            if (id === 103) return { img: IMAGES.MAIN, ...grid(2 + frame, 2) };
            if (id === 123) return { img: IMAGES.MAIN, ...grid(2 + frame, 1) };
            if (id === 113) return { img: IMAGES.MAIN, ...grid(2 + frame, 0) };
            if (id === 102) return { img: IMAGES.HEARTS, ...grid(2 + frame, 2) };
            if (id === 122) return { img: IMAGES.HEARTS, ...grid(2 + frame, 1) };
            if (id === 112) return { img: IMAGES.HEARTS, ...grid(2 + frame, 0) };
            if (id === 101) return { img: IMAGES.HEARTS, ...grid(2 + frame, 5) };
            if (id === 121) return { img: IMAGES.HEARTS, ...grid(2 + frame, 4) };
            if (id === 111) return { img: IMAGES.HEARTS, ...grid(2 + frame, 3) };
            if (id === 131) {
                return frame !== 2
                    ? { img: IMAGES.EFFECTS, ...grid(frame, 9) }
                    : { img: IMAGES.EFFECTS, ...grid(3, 8) };
            }
            return null;
        }
    },

    EXPLOSION: {
        getSprite: (form, isCrushed, frameIdx) => {
            const safeFrame = frameIdx % 2;
            const baseCol = isCrushed ? 4 : ((form === 2) ? 2 : 0);
            return { img: IMAGES.EFFECTS, ...grid(6, baseCol + safeFrame) };
        }
    },

    DEAD_BODY: {
        getSprite: (originalId, form, dir, isCrushed, colorTheme) => {
            if (originalId === 16 || (originalId >= 21 && originalId <= 26)) {
                const col = originalId === 26 ? 0 : (colorTheme || 0);
                return { img: IMAGES.VARIANTS, ...grid(2, col) };
            }

            let col = 0;
            if (originalId === 1) {
                if (form === 1) col = (dir === DIR.LEFT) ? 1 : 0;
                else col = (dir === DIR.LEFT) ? 3 : 2;
            } else if (originalId >= 11) {
                col = (originalId - 11) + 4;
            }
            if (isCrushed) col += 2;
            return { img: IMAGES.EFFECTS, ...grid(2, col) };
        }
    },

    TRIGGERS: {
        getSprite: (id, colorTheme) => {
            const baseCol = id === 3 ? 0 : 1;
            return { img: IMAGES.MAIN, ...pos(256, baseCol + colorTheme * 3, 1) };
        }
    },

    COLOR_TRIGGERS: {
        getSprite: (id) => {
            const cols = { 11: 0, 12: 1, 13: 2, 14: 3, 16: 4 };
            if (cols[id] === undefined) return null;
            return { img: IMAGES.TRIGGERS, ...grid(0, cols[id]) };
        }
    },

    TORCHES: {
        getFlameSprite: (colorTheme) => {
            const baseCol = TORCH_THEME_COLS[colorTheme] ?? TORCH_THEME_COLS[0];
            return { img: IMAGES.MAIN, ...grid(13, baseCol) };
        },
        getBaseSprite: (colorTheme) => {
            const baseCol = TORCH_THEME_COLS[colorTheme] ?? TORCH_THEME_COLS[0];
            return { img: IMAGES.MAIN, ...grid(13, baseCol + 1) };
        },
        getSprite: (colorTheme) => SPRITE_CONFIG.TORCHES.getFlameSprite(colorTheme)
    },

    WALLS: {
        getSprite: (colorTheme, moyouId) => {
            const shape = WALL_MAPPING[moyouId];
            if (!shape) {
                console.warn(`[Render] Missing wall moyou mapping: ${moyouId}`);
                return null;
            }

            const imgKey = shape.img || 'MAIN';
            const colOffset = shape.colored === false ? 0 : colorTheme * (shape.colsPerColor || 3);
            return {
                img: IMAGES[imgKey],
                ...pos(WALL_IMAGE_HEIGHT[imgKey], colOffset + shape.c, shape.r)
            };
        },
        getBody: (colorTheme, moyouId) => SPRITE_CONFIG.WALLS.getSprite(colorTheme, moyouId),
        getOverlay: () => null
    }
};
