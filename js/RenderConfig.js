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
    WALL_4: 'assets/chara_set_tsuika4.png'
};


function grid(row, col) {
    return { x: col * 16, y: row * 16 };
}

function pos(h, col, row) {
    return { x: col * 16, y: h - (row + 1) * 16 };
}
const SPRITE_CONFIG = {
    HEROINE: {
        getSprite: (form, dir, tick) => {
            const isBlink = (tick > 45);
            const row = isBlink ? 1 : 0;
            let col = 0;
            if (form === 1) col = (dir === 2) ? 1 : 0;
            else col = (dir === 2) ? 3 : 2;
            return { img: IMAGES.MAIN, ...grid(row, col) };
        }
    },

    ENEMIES: {
        SIMPLE: {
            getSprite: (id, tick) => {
                const isBlink = (tick > 45);
                const row = isBlink ? 1 : 0;
                // id 11->4, 12->5...
                const col = (id - 11) + 4;
                return { img: IMAGES.MAIN, ...grid(row, col) };
            }
        },
        COLOR: {
            getSprite: (id, colorTheme, tick) => {
                const isBlink = (tick > 30);
                const row = isBlink ? 1 : 0;
                let col = 0;
                // 变色魔像：颜色完全跟随关卡 Theme
                if (id === 16) {
                    col = colorTheme;
                }
                // 固定颜色魔像：颜色写死，不随关卡变
                else if (id === 21) col = 1; // g1: Blue
                else if (id === 22) col = 2; // g2: Red
                else if (id === 23) col = 3; // g3: Green
                else if (id === 24) col = 4; // g4: Yellow
                else if (id === 25) col = 6; // g5: Purple (跳过深蓝)
                else if (id === 26) col = 0; // g6: Gray

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
                if (frame != 2)
                    return { img: IMAGES.EFFECTS, ...grid(frame, 9) };
                else {
                    return { img: IMAGES.EFFECTS, ...grid(3, 8) };
                }
            }
            return null;
        }
    },
    // Col 0,1: 银发战斗
    // Col 2,3: 粉发战斗
    // Col 4,5: 压死 (isCrushed)
    EXPLOSION: {
        getSprite: (form, isCrushed, frameIdx) => {
            const safeFrame = frameIdx % 2; // 2帧循环
            let baseCol = 0;
            if (isCrushed) {
                baseCol = 4;
            } else {
                baseCol = (form === 2) ? 2 : 0;
            }
            const finalCol = baseCol + safeFrame;
            return { img: IMAGES.EFFECTS, ...grid(6, finalCol) };
        }
    },

    DEAD_BODY: {
        getSprite: (originalId, form, dir, isCrushed, colorTheme) => {
            // 魔像 (ID 16 或 21-26) -> 使用 VARIANTS 图集 Row 2
            if (originalId === 16 || (originalId >= 21 && originalId <= 26)) {
                let col = colorTheme || 0;
                // 特殊：如果是 g6 (灰魔像 ID 26)，通常强制为灰色 (Col 0)
                if (originalId === 26) col = 0;
                return { img: IMAGES.VARIANTS, ...grid(2, col) };
            }

            let col = 0;
            if (originalId === 1) {
                if (form === 1) col = (dir === 2) ? 1 : 0;
                else col = (dir === 2) ? 3 : 2;
            } else if (originalId >= 11) {
                col = (originalId - 11) + 4;
            }
            if (isCrushed) col += 2;
            return { img: IMAGES.EFFECTS, ...grid(2, col) };
        }
    },

    TRIGGERS: {
        getSprite: (id, colorTheme) => {
            const baseCol = (id === 3) ? 0 : 1;
            const offset = colorTheme * 3;
            const finalCol = baseCol + offset;
            return { img: IMAGES.MAIN, ...pos(256, finalCol, 1) };

        }
    },
    // 变色地板 (Color Triggers) - chara_irohenka
    // 顺序：蓝(0), 红(1), 绿(2), 黄(3), 紫(4)
    COLOR_TRIGGERS: {
        getSprite: (id) => {
            let colIndex = 0;
            switch (id) {
                case 11: colIndex = 0; break; // Blue
                case 12: colIndex = 1; break; // Red
                case 13: colIndex = 2; break; // Green
                case 14: colIndex = 3; break; // Yellow
                case 16: colIndex = 4; break; // Purple
                default: return null;
            }
            return { img: IMAGES.TRIGGERS, ...grid(0, colIndex) };
        }
    },
    WALLS: {
        // A. 实体 (Body) - 核心修复
        getBody: (colorTheme, moyouId, x, y) => {
            // 1. 计算颜色列偏移 (每色 3 列)
            const colOffset = colorTheme * 3;

            // 2. 默认形状查找
            let shape = WALL_MAPPING[moyouId];

            // --- [关键逻辑：内部障碍物渲染] ---
            if (moyouId === 26) {
                shape = { r: 1, c: 2 };
            }
            // 蜡烛逻辑
            else if (moyouId === 1 && x % 3 === 0) {
                shape = { r: 2, c: 0 };
            }
            // 如果没找到或属于复杂形状，用默认中心块
            else if (!shape || moyouId > 14) {
                shape = { r: 6, c: 1 };
            }

            const finalCol = colOffset + shape.c;

            // 返回配置 (chara_set 高 256)
            return { img: IMAGES.MAIN, ...pos(256, finalCol, shape.r) };
        },

        // B. 覆盖 (Overlay) - 保持不变，负责画线框
        getOverlay: (colorTheme, moyouId) => {
            // 简单形状 (0-14) 以及 我们的内部障碍 (26) 不画线框
            if (moyouId <= 14 || moyouId === 26) return null;

            const shape = WALL_MAPPING[moyouId];
            if (!shape) return null;

            const imgKey = shape.img || 'WALL_COL';
            let imgHeight = (imgKey === 'WALL_3') ? 240 : 64;
            let colsPerColor = 3;

            const colOffset = colorTheme * colsPerColor;
            return { img: IMAGES[imgKey], ...pos(imgHeight, colOffset + shape.c, shape.r) };
        }
    },
};

// ==========================================
// 墙壁统一映射表 (Moyou ID -> {r, c})
// r: 从下往上数 (0是最底行)
// c: 0, 1, 2 (在颜色块内的相对列)
// ==========================================
const WALL_MAPPING = {
    // === 简单形状 (0-14) ===
    // 这些坐标对应 IMAGES.MAIN (chara_set)
    0: { r: 6, c: 1 },

    // 边界
    3: { r: 5, c: 1 },
    6: { r: 7, c: 1 },
    5: { r: 6, c: 0 },
    4: { r: 6, c: 2 },

    // 角落
    7: { r: 4, c: 1 },
    9: { r: 3, c: 1 },
    10: { r: 3, c: 0 },
    8: { r: 4, c: 0 },

    11: { r: 7, c: 2 },
    12: { r: 7, c: 0 },
    13: { r: 5, c: 0 },
    14: { r: 5, c: 2 },

    // 装饰
    1: { r: 3, c: 2 },
    2: { r: 4, c: 2 },

    // === 复杂覆盖 (15+) ===
    // 这些坐标对应 Overlay (默认 WALL_COL, 指定则为 WALL_3/4)

    // tsuika2 (WALL_COL) - 默认
    15: { r: 2, c: 2 },
    16: { r: 2, c: 1 },
    18: { r: 0, c: 2 },
    19: { r: 3, c: 2 },
    20: { r: 2, c: 0 },
    21: { r: 1, c: 2 },
    22: { r: 0, c: 0 },
    23: { r: 1, c: 1 },
    25: { r: 0, c: 1 },
    47: { r: 2, c: 1 },

    // tsuika3 (WALL_3) - 336x240 (3列x15行)

    36: { img: 'WALL_3', r: 7, c: 0 },
    38: { img: 'WALL_3', r: 10, c: 0 },
    39: { img: 'WALL_3', r: 10, c: 2 },

    // tsuika4 (WALL_4)
    // 50: { img: 'WALL_4', r: 0, c: 0 }
};
