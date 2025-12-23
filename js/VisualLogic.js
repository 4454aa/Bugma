class VisualLogic {
    constructor(gameState) {
        this.state = gameState;
    }

    // 辅助：判断某格是否是墙壁 (ID 2 或 ID 8)
    isWall(x, y) {
        if (x < 0 || x >= 14 || y < 0 || y >= 14) return false; // 边界视为非墙(或者视具体逻辑而定，原版边界不报错但取不到值)
        const id = this.state.gridForeground[x][y];
        return id === 2 || id === 8;
    }

    updateAutoTiling() {
        const grid = this.state.gridForeground;
        const tex = this.state.gridTexture; // moyou
        const SIZE = 14;

        // 清空旧纹理
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                tex[x][y] = 0;
            }
        }

        // ==========================================
        // Pass 1: 基础连接 (上下左右)
        // ==========================================
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                // 只处理墙壁
                if (!this.isWall(x, y)) continue;

                // --- Up (上方) ---
                if (y > 0) {
                    if (!this.isWall(x, y - 1)) {
                        tex[x][y] = 1;
                    } else if (y > 1) {
                        if (!this.isWall(x, y - 2)) {
                            tex[x][y] = 2;
                        } else if (y > 2 && !this.isWall(x, y - 3)) {
                            tex[x][y] = 3;
                        }
                    }
                }

                // --- Right (右方) ---
                if (x < 13) {
                    // 检查右上区域
                    if (y > 1 && !this.isWall(x + 1, y - 2)) {
                        if (tex[x][y] === 0) tex[x][y] = 4;
                        else if (tex[x][y] === 3) tex[x][y] = 14;
                    }
                    if (y > 0 && !this.isWall(x + 1, y - 1)) {
                        if (tex[x][y] === 0) tex[x][y] = 4;
                        else if (tex[x][y] === 3) tex[x][y] = 14;
                    }
                    // 正右
                    if (!this.isWall(x + 1, y)) {
                        if (tex[x][y] === 0) tex[x][y] = 4;
                        else if (tex[x][y] === 3) tex[x][y] = 14;
                    }
                }

                // --- Left (左方) ---
                if (x > 0) {
                    // 检查左上区域
                    if (y > 1 && !this.isWall(x - 1, y - 2)) {
                        if (tex[x][y] === 0) tex[x][y] = 5;
                        else if (tex[x][y] === 3) tex[x][y] = 13;
                        else if (tex[x][y] === 4) tex[x][y] = 18;
                        else if (tex[x][y] === 14) tex[x][y] = 15;
                    }
                    if (y > 0 && !this.isWall(x - 1, y - 1)) {
                        if (tex[x][y] === 0) tex[x][y] = 5;
                        else if (tex[x][y] === 3) tex[x][y] = 13;
                        else if (tex[x][y] === 4) tex[x][y] = 18;
                        else if (tex[x][y] === 14) tex[x][y] = 15;
                    }
                    // 正左
                    if (!this.isWall(x - 1, y)) {
                        if (tex[x][y] === 0) tex[x][y] = 5;
                        else if (tex[x][y] === 3) tex[x][y] = 13;
                        else if (tex[x][y] === 4) tex[x][y] = 18;
                        else if (tex[x][y] === 14) tex[x][y] = 15;
                    }
                }

                // --- Down (下方) ---
                if (y < 13 && !this.isWall(x, y + 1)) {
                    if (tex[x][y] === 0) tex[x][y] = 6;
                    else if (tex[x][y] === 3) tex[x][y] = 21;
                    else if (tex[x][y] === 4) tex[x][y] = 11;
                    else if (tex[x][y] === 5) tex[x][y] = 12;
                    else if (tex[x][y] === 13) tex[x][y] = 17;
                    else if (tex[x][y] === 14) tex[x][y] = 16;
                    else if (tex[x][y] === 15) tex[x][y] = 20;
                    else if (tex[x][y] === 18) tex[x][y] = 19;
                }

                // --- 特殊纵向检查 (柱子?) ---
                if (x < 13 && y > 2 && !this.isWall(x + 1, y - 3) && tex[x][y] === 0) {
                    tex[x][y] = 8;
                }
                if (x > 0 && y > 2 && !this.isWall(x - 1, y - 3)) {
                    if (tex[x][y] === 0) tex[x][y] = 7;
                    else if (tex[x][y] === 8) tex[x][y] = 22;
                }

                // --- 对角线检查 ---
                // 右下
                if (x < 13 && y < 13 && !this.isWall(x + 1, y + 1)) {
                    if (tex[x][y] === 0) tex[x][y] = 10;
                    else if (tex[x][y] === 8) tex[x][y] = 25;
                }
                // 左下
                if (x > 0 && y < 13 && !this.isWall(x - 1, y + 1)) {
                    if (tex[x][y] === 0) tex[x][y] = 9;
                    else if (tex[x][y] === 10) tex[x][y] = 23;
                    else if (tex[x][y] === 7) tex[x][y] = 24;
                }

            } // end y
        } // end x

        // ==========================================
        // Pass 1.5: 阴影与遮挡 (ID 26)
        // ==========================================
        // 这部分在原代码里是单独的逻辑，不限于墙壁，这里整合进循环
        // 但根据上下文，它似乎也是针对 wall 的 context? 或者是给地板加阴影?
        // 原文写的是 if(y<13 ... tex[x][y] = 26). 如果 tex 是针对 wall 的，那这可能是在标记"墙下面的阴影"
        // 你的 chara_set_tsuika2 里如果有一块纯黑或半透黑，那对应的 index 应该填这里。
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                // 如果下方不是墙
                if (y < 13 && !this.isWall(x, y + 1)) {
                    // 上方悬空?
                    if (y > 1 && !this.isWall(x, y - 2)) tex[x][y] = 26;
                    if (y > 0 && !this.isWall(x, y - 1)) tex[x][y] = 26;
                }
                // 特殊遮挡
                if (y < 12 && !this.isWall(x, y + 2) && y > 0 && !this.isWall(x, y - 1)) {
                    tex[x][y] = 26;
                }
            }
        }

        // ==========================================
        // Pass 2: 角修正 (Corner Correction) - ID 27~49
        // ==========================================
        for (let x = 0; x < SIZE; x++) {
            for (let y = 0; y < SIZE; y++) {
                const currentMoyou = tex[x][y];

                // 1. 检查左下 (DL)
                if (x > 0 && y < 13) {
                    const dlWall = this.isWall(x - 1, y + 1);
                    const dlMoyou = tex[x - 1][y + 1];
                    // 条件: 左下不是墙，或者 左下是特殊块(26,1,2)
                    if (!dlWall || dlMoyou === 26 || dlMoyou === 1 || dlMoyou === 2) {
                        if (currentMoyou === 45) tex[x][y] = 47;
                        else if (currentMoyou === 3) tex[x][y] = 46;
                        else if (currentMoyou === 14) tex[x][y] = 44;
                        else if (currentMoyou === 35) tex[x][y] = 42;
                        else if (currentMoyou === 39) tex[x][y] = 41;
                        else if (currentMoyou === 4) tex[x][y] = 37;
                        else if (currentMoyou === 22) tex[x][y] = 34;
                        else if (currentMoyou === 8) tex[x][y] = 48;
                        else if (currentMoyou === 49) tex[x][y] = 27;
                    }
                }

                // 2. 检查右下 (DR)
                if (x < 13 && y < 13) {
                    const drWall = this.isWall(x + 1, y + 1);
                    const drMoyou = tex[x + 1][y + 1];
                    if (!drWall || drMoyou === 26 || drMoyou === 1 || drMoyou === 2) {
                        if (currentMoyou === 46) tex[x][y] = 47;
                        else if (currentMoyou === 3) tex[x][y] = 45;
                        else if (currentMoyou === 13) tex[x][y] = 43;
                        else if (currentMoyou === 34) tex[x][y] = 42;
                        else if (currentMoyou === 36) tex[x][y] = 40;
                        else if (currentMoyou === 5) tex[x][y] = 38;
                        else if (currentMoyou === 22) tex[x][y] = 35;
                        else if (currentMoyou === 24) tex[x][y] = 27;
                        else if (currentMoyou === 7) tex[x][y] = 49;
                    }
                }

                // 3. 检查右上 (UR)
                if (x < 13 && y > 0) {
                    const urWall = this.isWall(x + 1, y - 1);
                    const urMoyou = tex[x + 1][y - 1];
                    if (!urWall || urMoyou === 26 || urMoyou === 1 || urMoyou === 2) {
                        if (currentMoyou === 31) tex[x][y] = 33;
                        else if (currentMoyou === 6) tex[x][y] = 32;
                        else if (currentMoyou === 12) tex[x][y] = 29;
                        else if (currentMoyou === 27) tex[x][y] = 42;
                        else if (currentMoyou === 38) tex[x][y] = 40;
                        else if (currentMoyou === 5) tex[x][y] = 36;
                        else if (currentMoyou === 49) tex[x][y] = 35;
                        else if (currentMoyou === 23) tex[x][y] = 28;
                        else if (currentMoyou === 9) tex[x][y] = 48;
                    }
                }

                // 4. 检查左上 (UL)
                if (x > 0 && y > 0) {
                    const ulWall = this.isWall(x - 1, y - 1);
                    const ulMoyou = tex[x - 1][y - 1];
                    if (!ulWall || ulMoyou === 26 || ulMoyou === 1 || ulMoyou === 2) {
                        if (currentMoyou === 32) tex[x][y] = 33;
                        else if (currentMoyou === 6) tex[x][y] = 31;
                        else if (currentMoyou === 11) tex[x][y] = 30;
                        else if (currentMoyou === 28) tex[x][y] = 42;
                        else if (currentMoyou === 37) tex[x][y] = 41;
                        else if (currentMoyou === 4) tex[x][y] = 39;
                        else if (currentMoyou === 48) tex[x][y] = 34;
                        else if (currentMoyou === 23) tex[x][y] = 27;
                        else if (currentMoyou === 10) tex[x][y] = 49;
                    }
                }
            }
        }
    }
}