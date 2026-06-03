const LEVEL_LOADER_FALLBACK_TOKEN_MAP = Object.freeze([
    ["__", { fg: 0 }],
    ["||", { fg: 2 }],
    ["-|", { fg: 7 }],
    ["nn", { fg: 2 }],
    ["er", { fg: 0 }],
    ["sb", { bg: 1 }],
    ["he", { fg: 1 }],
    ["HE", { fg: 1 }],
    ["e1", { fg: 11 }],
    ["e2", { fg: 12 }],
    ["e3", { fg: 13 }],
    ["e4", { fg: 14 }],
    ["e5", { fg: 15 }],
    ["e6", { fg: 16 }],
    ["g1", { fg: 21 }],
    ["g2", { fg: 22 }],
    ["g3", { fg: 23 }],
    ["g4", { fg: 24 }],
    ["g5", { fg: 25 }],
    ["g6", { fg: 26 }],
    ["h1", { fg: 101 }],
    ["h2", { fg: 102 }],
    ["h3", { fg: 103 }],
    ["l1", { fg: 111 }],
    ["l2", { fg: 112 }],
    ["l3", { fg: 113 }],
    ["r1", { fg: 121 }],
    ["r2", { fg: 122 }],
    ["r3", { fg: 123 }],
    ["hm", { fg: 131 }],
    ["s1", { fg: 401 }],
    ["s2", { fg: 402 }],
    ["s3", { fg: 403 }],
    ["s4", { fg: 404 }],
    ["s5", { fg: 405 }],
    ["s6", { fg: 416 }],
    ["s7", { fg: 417 }],
    ["s8", { fg: 418 }],
    ["s9", { fg: 419 }],
    ["b1", { fg: 411 }],
    ["b2", { fg: 412 }],
    ["b3", { fg: 413 }],
    ["b4", { fg: 414 }],
    ["b5", { fg: 415 }],
    ["cs", { bg: 2 }],
    ["ce", { bg: 3 }],
    ["c1", { bg: 11 }],
    ["c2", { bg: 12 }],
    ["c3", { bg: 13 }],
    ["c4", { bg: 14 }],
    ["c6", { bg: 16 }],
    ["k1", { fg: 8, bg: 101 }],
    ["k2", { fg: 8, bg: 102 }],
    ["k3", { fg: 8, bg: 103 }],
    ["k4", { fg: 8, bg: 104 }],
    ["k5", { fg: 8, bg: 105 }],
    ["k6", { fg: 8, bg: 106 }],
    ["k7", { fg: 8, bg: 107 }],
    ["k8", { fg: 8, bg: 108 }],
    ["k9", { fg: 8, bg: 109 }],
    ["kd", { fg: 3 }],
    ["1|", { fg: 2, bg: 201 }],
    ["2|", { fg: 2, bg: 202 }],
    ["3|", { fg: 2, bg: 203 }],
    ["m|", { fg: 2, bg: 204 }],
    ["d|", { fg: 2, bg: 205 }],
    ["/|", { fg: 2, bg: 999 }]
].reduce((map, [token, def]) => {
    map[token] = Object.freeze(def);
    return map;
}, {}));

class LevelLoader {
    constructor(gameState) {
        this.state = gameState;
        this.TOKEN_MAP = typeof LEVEL_TOKEN_MAP !== "undefined"
            ? LEVEL_TOKEN_MAP
            : LEVEL_LOADER_FALLBACK_TOKEN_MAP;
    }

    loadLevel(levelId) {
        if (typeof ALL_LEVELS === 'undefined' || !ALL_LEVELS[levelId]) {
            console.error(`Level ${levelId} not found!`);
            return false;
        }

        return this.loadLevelData(ALL_LEVELS[levelId], levelId);
    }

    loadCustomLevel(levelData, levelId = 'custom') {
        return this.loadLevelData(levelData, levelId);
    }

    loadLevelData(levelData, levelId) {
        if (!levelData || !Array.isArray(levelData.map)) {
            console.error('Invalid level data: expected a map array.');
            return false;
        }

        const dims = this.resolveDimensions(levelData, levelId);
        if (!dims) return false;

        this.state.resizeGrid(dims.width, dims.height);
        this.state.currentStageId = String(levelId);
        this.state.player = { x: 0, y: 0, dir: DIR.RIGHT };
        this.state.playerForm = levelData.mode || 2;
        this.state.colorTheme = levelData.color || 0;
        this.state.resetRuntimeStats();
        this.clearGrids();

        const rawMap = levelData.map;
        for (let row = 0; row < dims.height; row++) {
            for (let col = 0; col < dims.width; col++) {
                const index = row * dims.width + col;
                if (index >= rawMap.length) break;

                const token = rawMap[index];
                const def = this.TOKEN_MAP[token];
                if (!def) continue;

                const targetX = col;
                const targetY = dims.height - 1 - row;

                if (def.fg !== undefined) {
                    this.state.gridForeground[targetX][targetY] = def.fg;
                }
                if (def.bg !== undefined) {
                    this.state.gridBackground[targetX][targetY] = def.bg;
                }
                if (def.fg === 1) {
                    this.state.player.x = targetX;
                    this.state.player.y = targetY;
                    this.state.player.dir = DIR.RIGHT;
                }
            }
        }

        this.state.syncMainToBuffer();
        console.log(`Level ${levelId} loaded. Size: ${dims.width}x${dims.height}, Mode: ${this.state.playerForm}, Color: ${this.state.colorTheme}`);
        return true;
    }

    resolveDimensions(levelData, levelId) {
        const hasWidth = levelData.width !== undefined;
        const hasHeight = levelData.height !== undefined;

        if (hasWidth !== hasHeight) {
            console.error('Invalid level data: width and height must be provided together.');
            return null;
        }

        const width = hasWidth ? Number(levelData.width) : 14;
        const height = hasHeight ? Number(levelData.height) : 14;

        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            console.error(`Invalid level size: ${levelData.width}x${levelData.height}`);
            return null;
        }

        const expectedLength = width * height;
        if ((hasWidth || hasHeight) && levelData.map.length !== expectedLength) {
            console.error(`Invalid map length: expected ${expectedLength}, got ${levelData.map.length}.`);
            return null;
        }

        if (!hasWidth && levelData.map.length !== expectedLength) {
            const isBundledLegacy = typeof ALL_LEVELS !== 'undefined'
                && ALL_LEVELS[String(levelId)] === levelData;
            if (isBundledLegacy) {
                console.warn(`Legacy official level ${levelId} has ${levelData.map.length} cells; loading as 14x14 for compatibility.`);
                return { width, height };
            }

            console.error(`Legacy level data must contain 196 cells, got ${levelData.map.length}. Rectangular maps require width and height.`);
            return null;
        }

        return { width, height };
    }

    clearGrids() {
        this.state.forEachCell((x, y) => {
            this.state.gridForeground[x][y] = 0;
            this.state.gridBackground[x][y] = 0;
            this.state.gridBuffer[x][y] = 0;
            this.state.gridTexture[x][y] = 0;
        });
    }
}
