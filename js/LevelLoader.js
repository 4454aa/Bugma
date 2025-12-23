class LevelLoader {
    constructor(gameState) {
        this.state = gameState;
        this.TOKEN_MAP = {
            // --- 基础 ---
            "__": { fg: 0 },   // 空气
            "||": { fg: 2 },   // 普通墙壁
            "he": { fg: 1 },   // 雪莉
            "HE": { fg: 1 },   //艾拉

            // --- 敌人 (Enemy) ---
            "e1": { fg: 11 }, // 哥布林
            "e2": { fg: 12 }, //盗贼
            "e3": { fg: 13 }, // 触手
            "e4": { fg: 14 }, // 暗影（类似于触手，双倍回复）
            "e5": { fg: 15 }, // 催眠怪
            "e6": { fg: 16 }, // 变色魔像，颜色由场景决定

            // --- 变种魔像，依次为蓝红绿黄紫灰
            "g1": { fg: 21 },
            "g2": { fg: 22 },
            "g3": { fg: 23 },
            "g4": { fg: 24 },
            "g5": { fg: 25 },
            "g6": { fg: 26 },

            // --- 机关/血条 (Hearts) ---
            "h1": { fg: 101 },//红色
            "h2": { fg: 102 },
            "h3": { fg: 103 },
            "l1": { fg: 111 },//黄色
            "l2": { fg: 112 },
            "l3": { fg: 113 },
            "r1": { fg: 121 },//蓝色
            "r2": { fg: 122 },
            "r3": { fg: 123 },
            "hm": { fg: 131 },//金心

            // --- 锁/开关 (Switches) ---
            "s1": { fg: 401 }, // 对应 Lock Blue
            "s2": { fg: 402 },
            "s3": { fg: 403 },
            "s4": { fg: 404 },
            "s5": { fg: 405 },
            "s6": { fg: 416 },
            "s7": { fg: 417 },
            "s8": { fg: 418 },
            "s9": { fg: 419 }, // 对应 Lock Purple

            "b1": { fg: 411 }, // 对应 Button/Switch
            "b2": { fg: 412 },
            "b3": { fg: 413 },
            "b4": { fg: 414 },
            "b5": { fg: 415 },

            // --- 复合墙壁 (Wall + Background) ---
            "k1": { fg: 8, bg: 101 }, // 特殊墙类型 1
            "k2": { fg: 8, bg: 102 },
            "k3": { fg: 8, bg: 103 },
            "k4": { fg: 8, bg: 104 },
            "k5": { fg: 8, bg: 105 },
            "k6": { fg: 8, bg: 106 },
            "k7": { fg: 8, bg: 107 },
            "k8": { fg: 8, bg: 108 },
            "k9": { fg: 8, bg: 109 },
            "kd": { fg: 3 }, // 门/楼梯 (Kaidan)

            // --- 复合地板 (Wall/Floor variants) ---
            "1|": { fg: 2, bg: 201 }, // 墙 + 地板类型1
            "2|": { fg: 2, bg: 202 },
            "3|": { fg: 2, bg: 203 },
            "m|": { fg: 2, bg: 204 },
            "d|": { fg: 2, bg: 205 },
            "/|": { fg: 2, bg: 999 }, // 阴影墙 (Shadow)

            // --- 纯背景/机关 (Background Only) ---
            "cs": { bg: 2 }, // 雪莉变身地板
            "ce": { bg: 3 }, // 艾拉变身地板
            "c1": { bg: 11 }, // 变色地板 (Blue)
            "c2": { bg: 12 }, // Red
            "c3": { bg: 13 }, // Green
            "c4": { bg: 14 }, // Yellow
            "c6": { bg: 16 }, // Purple

            // --- 其他 ---
            "-|": { fg: 7 }, // 可能是栏杆或边界
            "er": { fg: 0 }, // 橡皮擦? 视为 0
            "sb": { bg: 1 }, // Skybox/Void
            "nn": { fg: 2 }  // Null/None? 视为墙
        };
    }

    /**
     * 加载指定 ID 的关卡
     * @param {string} levelId - levels.js 中的键名 (如 "1", "53")
     */
    loadLevel(levelId) {
        // 1. 获取数据 (假设 ALL_LEVELS 是全局变量，或者你可以把它作为参数传入)
        if (typeof ALL_LEVELS === 'undefined' || !ALL_LEVELS[levelId]) {
            console.error(`Level ${levelId} not found!`);
            return;
        }
        this.state.currentStageId = levelId; // [新增]
        const levelData = ALL_LEVELS[levelId];
        const rawMap = levelData.map; // 1D array of strings (196 length)

        // 2. 设置全局状态
        this.state.gameStatus = 0; // 重置游戏状态
        this.state.playerForm = levelData.mode || 2; // 默认形态 2（雪莉）
        this.state.colorTheme = levelData.color || 0; // 默认颜色 0
        this.state.isInvincible = 0;
        // --- [新增] 重置历史记录与统计数据 ---
        this.state.history = [];       // 清空悔棋栈
        this.state.stepCount = 0;      // 重置步数
        this.state.replayString = "";  // 重置录像
        this.state.effects = [];       // 清空残留特效
        this.state.animTick = 0;       // 重置动画计时
        // ----------------------------------

        // 3. 清空网格
        this.clearGrids();

        // 4. 解析地图数据
        // 注意：C# 源码是 14x14，Y轴方向在解析时是反转的
        // 源码逻辑：arumono[haichiy, 13 - haichix] = token
        // 其中 haichix 是外层循环(行), haichiy 是内层循环(列)

        let index = 0;
        for (let row = 0; row < 14; row++) {
            for (let col = 0; col < 14; col++) {

                // 边界检查：防止 JSON 数据长度不足
                if (index >= rawMap.length) break;

                const token = rawMap[index];
                const def = this.TOKEN_MAP[token];

                if (def) {
                    // 坐标转换：
                    // rawMap 是按行存储的 (Visual Top-Down)
                    // targetX = col
                    // targetY = 13 - row (Visual Bottom-Up)
                    const targetX = col;
                    const targetY = 13 - row;

                    // 设置前景 (Objects)
                    if (def.fg !== undefined) {
                        this.state.gridForeground[targetX][targetY] = def.fg;
                    }

                    // 设置背景 (Floor)
                    if (def.bg !== undefined) {
                        this.state.gridBackground[targetX][targetY] = def.bg;
                    }

                    // 特殊处理：玩家位置
                    // 如果前景是 1，更新 playerPos
                    if (def.fg === 1) {
                        this.state.player.x = targetX;
                        this.state.player.y = targetY;
                        // 确保玩家朝向重置 (可选)
                        this.state.player.dir = 3; // 默认朝右
                    }
                } else {
                    // console.warn(`Unknown token: ${token}`);
                }

                index++;
            }
        }

        // 5. 初始化缓冲区 (Buffer)
        this.state.syncMainToBuffer();

        console.log(`Level ${levelId} loaded. Mode: ${this.state.playerForm}, Color: ${this.state.colorTheme}`);
    }

    clearGrids() {
        for (let x = 0; x < 14; x++) {
            for (let y = 0; y < 14; y++) {
                this.state.gridForeground[x][y] = 0;
                this.state.gridBackground[x][y] = 0;
                this.state.gridBuffer[x][y] = 0;
                this.state.gridTexture[x][y] = 0;
            }
        }
    }

    /**
     * 加载自定义关卡数据
     * @param {Object} levelData - 关卡数据对象，包含map、mode、color等属性
     */
    loadCustomLevel(levelData) {
        // 1. 验证数据
        if (!levelData || !levelData.map) {
            console.error('Invalid custom level data!');
            return;
        }

        const rawMap = levelData.map; // 1D array of strings (196 length)

        // 2. 设置全局状态
        this.state.gameStatus = 0; // 重置游戏状态
        this.state.playerForm = levelData.mode || 2; // 默认形态 2（雪莉）
        this.state.colorTheme = levelData.color || 0; // 默认颜色 0
        this.state.isInvincible = 0;
        // 重置历史记录与统计数据
        this.state.history = [];       // 清空悔棋栈
        this.state.stepCount = 0;      // 重置步数
        this.state.replayString = "";  // 重置录像
        this.state.effects = [];       // 清空残留特效
        this.state.animTick = 0;       // 重置动画计时

        // 3. 清空网格
        this.clearGrids();

        // 4. 解析地图数据
        // 注意：C# 源码是 14x14，Y轴方向在解析时是反转的
        // 源码逻辑：arumono[haichiy, 13 - haichix] = token
        // 其中 haichix 是外层循环(行), haichiy 是内层循环(列)

        let index = 0;
        for (let row = 0; row < 14; row++) {
            for (let col = 0; col < 14; col++) {

                // 边界检查：防止 JSON 数据长度不足
                if (index >= rawMap.length) break;

                const token = rawMap[index];
                const def = this.TOKEN_MAP[token];

                if (def) {
                    // 坐标转换：
                    // rawMap 是按行存储的 (Visual Top-Down)
                    // targetX = col
                    // targetY = 13 - row (Visual Bottom-Up)
                    const targetX = col;
                    const targetY = 13 - row;

                    // 设置前景 (Objects)
                    if (def.fg !== undefined) {
                        this.state.gridForeground[targetX][targetY] = def.fg;
                    }

                    // 设置背景 (Floor)
                    if (def.bg !== undefined) {
                        this.state.gridBackground[targetX][targetY] = def.bg;
                    }

                    // 特殊处理：玩家位置
                    // 如果前景是 1，更新 playerPos
                    if (def.fg === 1) {
                        this.state.player.x = targetX;
                        this.state.player.y = targetY;
                        // 确保玩家朝向重置 (可选)
                        this.state.player.dir = 3; // 默认朝右
                    }
                }

                index++;
            }
        }

        // 5. 初始化缓冲区 (Buffer)
        this.state.syncMainToBuffer();

        console.log(`Custom level loaded. Mode: ${this.state.playerForm}, Color: ${this.state.colorTheme}`);
    }
}