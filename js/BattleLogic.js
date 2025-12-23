class BattleLogic {
    constructor(gameState) {
        this.state = gameState;
        this.potentialInvincible = false;
        this.isInvincible=false;
    }

    // --- 1. 战斗总入口 ---
    resolveCombat(ex, ey, dx, dy) {
        // 1. 播放交互特效 (双方都有)
        const now = Date.now();
        const form = this.state.playerForm; // 1:银, 2:粉
        const enemyId = this.state.gridBuffer[ex][ey];
        const color = this.state.colorTheme;

        // 在怪物身上播特效
        this.state.effects.push({
            x: ex, y: ey, startTime: now,
            type: 'HIT', form: form, isCrushed: false
        });

        // 在主角身上播特效 (打击感)
        this.state.effects.push({
            x: this.state.player.x,
            y: this.state.player.y,
            startTime: now,
            type: 'HIT',
            form: form, // 也可以设为 0 表示通用受击
            isCrushed: false
        });

        // 临时记录战斗位置
        this.battlex = ex;
        this.battley = ey;
        //根据关卡确定的魔像
        if (enemyId === 16) {
            if (color === 1) this.mechanicBlue_Complex(ex, ey);      // 蓝色逻辑
            else if (color === 2) this.mechanicRed_Complex(ex, ey); // 红色特殊逻辑 (原 iro2sentou)
            else if (color === 3) this.mechanicGreen_Complex(ex, ey); // 绿色特殊逻辑
            else if (color === 4) this.mechanicYellow_Complex(ex, ey); // 黄色特殊逻辑
            else if (color === 6) this.mechanicPurple(ex, ey); // 紫色逻辑
            else this.mechanicBlue(ex, ey); // 默认
        }
        if (enemyId === 17) {
            console.log("Hit Zombie - No Effect");
            return;
        }
        //固定颜色魔像
        else if (enemyId >= 21 && enemyId <= 26) {
            if (enemyId === 21) this.mechanicBlue_Complex(ex, ey);
            else if (enemyId === 22) this.mechanicRed_Complex(ex, ey);
            else if (enemyId === 23) this.mechanicGreen_Complex(ex, ey);
            else if (enemyId === 24) this.mechanicYellow_Complex(ex, ey);
            else if (enemyId === 25) this.mechanicPurple(ex, ey);
            else this.mechanicBlue_Complex(ex, ey);
        }
        //普通怪物
        else {
            if (enemyId === 11) this.mechanicBlue(ex, ey);       // e1: 普通互殴
            else if (enemyId === 12) this.mechanicRed_Simple(ex, ey); // e2: 玩家扣2血
            else if (enemyId === 13) this.mechanicGreen_Simple(ex, ey); // e3: 敌人回血
            else if (enemyId === 14) this.mechanicYellow_Simple(ex, ey); // e4: 敌人回2血
            else if (enemyId === 15) this.mechanicHypno(ex, ey); // e5: 击飞
        }
    }

    // ==========================================
    //      核心数值计算 (含回溯逻辑)
    // ==========================================

    // --- 敌人受伤 (完整版) ---
    damageEnemy(ex, ey) {
        const bx = ex !== undefined ? ex : this.battlex;
        const by = ey !== undefined ? ey : this.battley;
        let hpy = by + 1; // 向下检测

        // 131 是特殊阻挡块
        if (this.state.gridBuffer[bx][hpy] === 131) return;

        // [阶段1] 向下扫描堆叠的血条 (3血 -> 2血 -> 1血)
        // 检查：个位是3，且在 100-200 之间
        while (
            (this.state.gridBuffer[bx][hpy] % 10 === 3) &&
            (this.state.gridBuffer[bx][hpy] > 100) &&
            (this.state.gridBuffer[bx][hpy] < 200)
        ) {
            if (hpy < 13) {
                // 检查连通性 (103 下面是 10x)
                let currentPrefix = Math.floor(this.state.gridBuffer[bx][hpy] / 10);
                let nextPrefix = Math.floor(this.state.gridBuffer[bx][hpy + 1] / 10);

                if (currentPrefix === nextPrefix) {
                    hpy++;
                    continue;
                }
                this.state.gridBuffer[bx][hpy]--;
                return;
            }
            this.state.gridBuffer[bx][hpy]--;
            return;
        }

        // 检查 2血
        if ((this.state.gridBuffer[bx][hpy] % 10 === 2) &&
            (this.state.gridBuffer[bx][hpy] > 100) &&
            (this.state.gridBuffer[bx][hpy] < 200)) {
            this.state.gridBuffer[bx][hpy]--;
            return;
        }

        // --- 处理 1血状态 (xx1 -> 死亡) ---
        if (
            (this.state.gridBuffer[bx][hpy] % 10 === 1) &&
            (this.state.gridBuffer[bx][hpy] > 100) &&
            (this.state.gridBuffer[bx][hpy] < 200)
        ) {
            this.state.gridBuffer[bx][hpy] = 0;

            let entityId = this.state.gridBuffer[bx][hpy - 1];
            //有心还活
            if (entityId >= 100 && entityId <= 200) {
                return;
            }
           if (this.potentialInvincible) {
                let zombieId = (entityId === 16) ? 17 : 18;
                
                this.state.gridBuffer[bx][hpy - 1] = zombieId; 
                
                console.log(`Enemy ${entityId} became Zombie ID ${zombieId}`);
                return; // 活着 (变成僵尸)
            }

            // 正常死亡 (红魔像/黄魔像等会走到这里)
            if (entityId > 10 && entityId <= 26) {
                this.state.gridBuffer[bx][hpy - 1] = 0; // 清除
                this.state.effects.push({
                    x: bx, y: hpy - 1, startTime: Date.now(),
                    type: 'DIE', id: entityId, form: this.state.playerForm, isCrushed: false
                });
                console.log("Enemy Died!");
            }
            return;

        }

        // [阶段2] 回溯逻辑 (The Missing Part)
        // 如果上面都没 return，说明第一轮检测没命中有效操作，回退一格再试
        hpy--;

        // 回溯后检查 3血
        if ((this.state.gridBuffer[bx][hpy] % 10 === 3) &&
            (this.state.gridBuffer[bx][hpy] > 100) &&
            (this.state.gridBuffer[bx][hpy] < 200)) {
            this.state.gridBuffer[bx][hpy]--;
        }
        // 回溯后检查 2血
        else if ((this.state.gridBuffer[bx][hpy] % 10 === 2) &&
            (this.state.gridBuffer[bx][hpy] > 100) &&
            (this.state.gridBuffer[bx][hpy] < 200)) {
            this.state.gridBuffer[bx][hpy]--;
        }
        // 回溯后检查 1血
        else {
            if ((this.state.gridBuffer[bx][hpy] % 10 === 1) &&
                (this.state.gridBuffer[bx][hpy] > 100) &&
                (this.state.gridBuffer[bx][hpy] < 200)) {

                this.state.gridBuffer[bx][hpy] = 0; // 清除血条

                let entityId = this.state.gridBuffer[bx][hpy - 1];
                // 【核心修复】无敌/僵尸转化逻辑
                // 对应源码: if (fujimininarukanousei == 1) ...
                if (this.potentialInvincible) {
                    if (entityId === 16) {
                        this.state.gridBuffer[bx][hpy - 1] = 17;
                    } else {
                        this.state.gridBuffer[bx][hpy - 1] = 18;
                    }

                    console.log("Enemy became Zombie (Fujimi State)");
                    return; // 【关键】直接返回，不执行清除怪物和爆炸逻辑
                }
                if (entityId > 10 && entityId <= 26) {
                    this.state.gridBuffer[bx][hpy - 1] = 0; // 怪物死亡
                    // [新增] 添加特效
                    this.state.effects.push({
                        x: bx,
                        y: hpy - 1,
                        startTime: Date.now()
                    });
                }
            }
        }
    }

    // --- 主角受伤 (完整版) ---
    damagePlayer() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py + 1;

        if (this.state.gridBuffer[px][hpy] === 131) return;

        // [阶段1] 正常向下扫描
        while (
            (this.state.gridBuffer[px][hpy] % 10 === 3) &&
            (this.state.gridBuffer[px][hpy] > 100) &&
            (this.state.gridBuffer[px][hpy] < 200)
        ) {
            if (hpy < 13) {
                let currentPrefix = Math.floor(this.state.gridBuffer[px][hpy] / 10);
                let nextPrefix = Math.floor(this.state.gridBuffer[px][hpy + 1] / 10);
                if (currentPrefix === nextPrefix) {
                    hpy++;
                    continue;
                }
                this.state.gridBuffer[px][hpy]--;
                return;
            }
            this.state.gridBuffer[px][hpy]--;
            return;
        }

        if ((this.state.gridBuffer[px][hpy] % 10 === 2) &&
            (this.state.gridBuffer[px][hpy] > 100) &&
            (this.state.gridBuffer[px][hpy] < 200)) {
            this.state.gridBuffer[px][hpy]--;
            return;
        }

        if ((this.state.gridBuffer[px][hpy] % 10 === 1) &&
            (this.state.gridBuffer[px][hpy] > 100) &&
            (this.state.gridBuffer[px][hpy] < 200)) {

            this.state.gridBuffer[px][hpy] = 0;

            // 检查上方是否是主角
            if (this.state.gridBuffer[px][hpy - 1] === 1) {
                // 【核心修复】触发无敌
                if (this.potentialInvincible) {
                    this.state.isInvincible = 1; // 激活全局无敌状态 (fujimi)
                    console.log("Player entered Fujimi State!");
                    return; // 【关键】不判死
                }
                if (this.state.isInvincible === 1) {
                    this.state.isInvincible = 1; // 保持无敌
                    return;
                }
                // 游戏结束逻辑
                this.state.gridBuffer[px][hpy - 1] = 0;
                this.state.gameStatus = 2; // LOSE
                console.log("Player Died!");
                return;
            }
            return;
        }

        // [阶段2] 回溯逻辑 (The Missing Part)
        hpy--;

        if ((this.state.gridBuffer[px][hpy] % 10 === 3) &&
            (this.state.gridBuffer[px][hpy] > 100) &&
            (this.state.gridBuffer[px][hpy] < 200)) {
            this.state.gridBuffer[px][hpy]--;
        }
        else if ((this.state.gridBuffer[px][hpy] % 10 === 2) &&
            (this.state.gridBuffer[px][hpy] > 100) &&
            (this.state.gridBuffer[px][hpy] < 200)) {
            this.state.gridBuffer[px][hpy]--;
        }
        else {
            if ((this.state.gridBuffer[px][hpy] % 10 === 1) &&
                (this.state.gridBuffer[px][hpy] > 100) &&
                (this.state.gridBuffer[px][hpy] < 200)) {

                this.state.gridBuffer[px][hpy] = 0;

                if (this.state.gridBuffer[px][hpy - 1] === 1) {
                    if (this.state.isInvincible === 1) return;
                    this.state.gridBuffer[px][hpy - 1] = 0;
                    this.state.gameStatus = 2;
                }
            }
        }
    }
    // ==========================================
    //      辅助数值计算 (HP增加 / 击飞)
    // ==========================================

    // --- 敌人HP增加 (对应 enemyhpfueru) ---
    // 逻辑：扫描敌人血条，尝试升级现有血条 (1->2, 2->3) 或在空位生成 1血
    enemyhpfueru() {
        // fueruretsu: 标记当前处理到哪种类型的血条 (-1:未定, 0:10x, 1:11x, 2:12x, 4:131)
        let fueruretsu = -1;
        let hpy = this.battley + 1;

        while (hpy <= 13) {
            let id = this.state.gridBuffer[this.battlex][hpy];

            // 遇到阻挡块 (131)
            if (id === 131) {
                if (fueruretsu === 4 || fueruretsu === -1) {
                    hpy++;
                    fueruretsu = 4;
                    continue;
                }
                break;
            }
            // 遇到 1血 或 2血 (可以升级)
            // 101, 102
            if (id === 101 || id === 102) {
                if (fueruretsu === 0 || fueruretsu === -1) {
                    this.state.gridBuffer[this.battlex][hpy]++;
                }
                break;
            }
            // 遇到 3血 (满血，不能升级，继续往下找)
            if (id === 103) {
                if (fueruretsu === 0 || fueruretsu === -1) {
                    hpy++;
                    fueruretsu = 0;
                    continue;
                }
                break;
            }
            // 处理 11x 系列 (111, 112)
            if (id === 111 || id === 112) {
                if (fueruretsu === 1 || fueruretsu === -1) {
                    this.state.gridBuffer[this.battlex][hpy]++;
                }
                break;
            }
            if (id === 113) {
                if (fueruretsu === 1 || fueruretsu === -1) {
                    hpy++;
                    fueruretsu = 1;
                    continue;
                }
                break;
            }
            // 处理 12x 系列
            if (id === 121 || id === 122) {
                if (fueruretsu === 2 || fueruretsu === -1) {
                    this.state.gridBuffer[this.battlex][hpy]++;
                }
                break;
            }
            if (id === 123) {
                if (fueruretsu === 2 || fueruretsu === -1) {
                    hpy++;
                    fueruretsu = 2;
                    continue;
                }
                break;
            }
            // 遇到空地 (生成新血条)
            if (id === 0) {
                if (fueruretsu === 4) {
                    this.state.gridBuffer[this.battlex][hpy] = 131;
                    break;
                }
                if (fueruretsu === 0 || fueruretsu === -1) {
                    this.state.gridBuffer[this.battlex][hpy] = 101;
                    break;
                }
                if (fueruretsu === 1) {
                    this.state.gridBuffer[this.battlex][hpy] = 111;
                    break;
                }
                if (fueruretsu === 2) {
                    this.state.gridBuffer[this.battlex][hpy] = 121;
                    break;
                }
                break; // Should not allow others
            }
            break;
        }
    }

    // --- 主角HP击飞/跳跃 (对应 heroinehptobasu) ---
    // 逻辑：根据朝向，改变血条的排列顺序或数值 (模拟被击飞效果)
    heroinehptobasu() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py + 1;
        const dir = this.state.player.dir; // 3=Right, 其他视为Left/Up/Down

        // 原代码逻辑分 houkou == 3 (Right) 和 其他
        if (dir === 3) {
            if (this.state.gridForeground[px][hpy] === 131) return; // gridForeground/Buffer注意同步

            while (true) {
                let id = this.state.gridBuffer[px][hpy];
                let type = Math.floor(id / 10); // 10, 11, 12...

                if (type === 10) {
                    this.state.gridBuffer[px][hpy] += 10; // 变成 11x
                } else if (type === 11) {
                    this.state.gridBuffer[px][hpy] = 0; // 消失
                    // 如果左边是空的，移到左边？(原代码: heroinex-1)
                    if (px > 0 && this.state.gridBuffer[px - 1][hpy] === 0) {
                        this.state.gridBuffer[px - 1][hpy] = id + 10; // 这里的 id 是旧值
                    }
                } else if (type === 12) {
                    this.state.gridBuffer[px][hpy] -= 20; // 变回 10x
                }

                // 检查是否继续循环 (如果是满血3，且下一格也是同类型)
                if (hpy < 13 && (id % 10 === 3) && (type === Math.floor(this.state.gridBuffer[px][hpy + 1] / 10))) {
                    hpy++;
                    continue;
                }
                break;
            }
        } else {
            // 非向右 (左/上/下)
            if (this.state.gridBuffer[px][hpy] === 131) return;

            while (true) {
                let id = this.state.gridBuffer[px][hpy];
                let type = Math.floor(id / 10);

                if (type === 10) {
                    this.state.gridBuffer[px][hpy] += 20; // 变成 12x
                } else if (type === 11) {
                    this.state.gridBuffer[px][hpy] -= 10; // 变成 10x
                } else if (type === 12) {
                    this.state.gridBuffer[px][hpy] = 0; // 消失
                    // 移到右边
                    if (px < 13 && this.state.gridBuffer[px + 1][hpy] === 0) {
                        this.state.gridBuffer[px + 1][hpy] = id - 10;
                    }
                }

                if (hpy < 13 && (id % 10 === 3) && (type === Math.floor(this.state.gridBuffer[px][hpy + 1] / 10))) {
                    hpy++;
                    continue;
                }
                break;
            }
        }
    }



    // ==========================================
    //      颜色与变种机制
    // ==========================================

    // 1. 蓝色 (Blue) / 默认:不反击
    mechanicBlue(ex, ey) {
        this.damageEnemy(ex, ey);
        this.damagePlayer();
    }
    mechanicBlue_Complex(ex, ey) {
        this.damageEnemy(ex, ey);
        //this.damagePlayer();
    }
    // 2. 红色 (Red): 玩家扣双倍血 (ID 12)
    mechanicRed_Simple(ex, ey) {
        this.damageEnemy(ex, ey);
        this.damagePlayer();
        this.damagePlayer(); // 第二次扣血
    }

    // 6. 紫色 (Purple): 互换/无敌判定 (对应 iro5sentou / ID 16 + Color 6)
    // 2. 紫色逻辑 (核心修复)
    // 2. 紫色逻辑 (核心修复)
    mechanicPurple(ex, ey) {
        // 开启临时判定
        this.potentialInvincible = true;

        this.damageEnemy(ex, ey);
        this.damagePlayer();

        // 关闭临时判定
        this.potentialInvincible = false;
    }


    // --- 红色复杂逻辑 (对应 iro2sentou) ---
    // 核心机制：交换 (Swap)。扫描敌人血条存入缓存，然后根据玩家血条重写敌人血条，反之亦然。
    mechanicRed_Complex(ex, ey) {
        // 1. 扫描敌人血条 -> 存入 akaheartkioku
        let akaheartkioku = new Array(14).fill(0);
        let akaheartichi = 0; // 状态机：0=初始, 1=10x, 2=11x, 3=12x, 4=131
        let hpy = ey;

        while (true) {
            hpy++;
            if (hpy >= 14) break;
            let id = this.state.gridForeground[ex][hpy]; // 读原始数据

            if (id < 101 || id > 131) break; // 不是血条

            if (id === 131) {
                if (akaheartichi !== 4 && akaheartichi !== 0) break;
                akaheartichi = 4;
                akaheartkioku[hpy] = id;
                this.state.gridBuffer[ex][hpy] = 0; // 暂时清空敌人位置
            } else if (id >= 120) {
                if (akaheartichi !== 3 && akaheartichi !== 0) break;
                akaheartichi = 3;
                akaheartkioku[hpy] = id;
                this.state.gridBuffer[ex][hpy] = 0;
                if (id % 10 !== 3) break;
            } else if (id >= 110) {
                if (akaheartichi !== 2 && akaheartichi !== 0) break;
                akaheartichi = 2;
                akaheartkioku[hpy] = id;
                this.state.gridBuffer[ex][hpy] = 0;
                if (id % 10 !== 3) break;
            } else {
                if (akaheartichi !== 1 && akaheartichi !== 0) break;
                akaheartichi = 1;
                akaheartkioku[hpy] = id;
                this.state.gridBuffer[ex][hpy] = 0;
                if (id % 10 !== 3) break;
            }
        }

        // 2. 扫描主角血条 -> 写入敌人位置 (变换类型)
        const px = this.state.player.x;
        const py = this.state.player.y;
        hpy = py;
        akaheartichi = 0;

        while (true) {
            hpy++;
            if (hpy >= 14) break;
            let id = this.state.gridForeground[px][hpy];
            if (id < 101 || id > 131) break;

            if (id === 131) {
                if (akaheartichi !== 4 && akaheartichi !== 0) break;
                akaheartichi = 4;
                if (this.state.gridBuffer[ex][hpy] === 0) this.state.gridBuffer[ex][hpy] = id;
                this.state.gridBuffer[px][hpy] = 0; // 清空主角位置
            } else if (id >= 120) {
                if (akaheartichi !== 3 && akaheartichi !== 0) break;
                akaheartichi = 3;
                // 变换规则: 12x -> 11x (-10)
                if (this.state.gridBuffer[ex][hpy] === 0) this.state.gridBuffer[ex][hpy] = id - 10;
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            } else if (id >= 110) {
                if (akaheartichi !== 2 && akaheartichi !== 0) break;
                akaheartichi = 2;
                // 变换规则: 11x -> 12x (+10)
                if (this.state.gridBuffer[ex][hpy] === 0) this.state.gridBuffer[ex][hpy] = id + 10;
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            } else {
                if (akaheartichi !== 1 && akaheartichi !== 0) break;
                akaheartichi = 1;
                // 变换规则: 10x -> 10x (不变)
                if (this.state.gridBuffer[ex][hpy] === 0) this.state.gridBuffer[ex][hpy] = id;
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            }
        }

        // 3. 将缓存的 enemies (akaheartkioku) -> 写入主角位置 (变换类型)
        hpy = py;
        while (true) {
            hpy++;
            if (hpy >= 14 || this.state.gridBuffer[px][hpy] !== 0) break; // 确保不覆盖

            let id = akaheartkioku[hpy];
            if (id === 0) break;

            if (id === 131) {
                this.state.gridBuffer[px][hpy] = id;
            } else if (id >= 120) {
                this.state.gridBuffer[px][hpy] = id - 10;
            } else if (id >= 110) {
                this.state.gridBuffer[px][hpy] = id + 10;
            } else if (id >= 100) {
                this.state.gridBuffer[px][hpy] = id;
            }
        }
    }

    mechanicGreen_Simple(ex, ey) { // e3
        this.enemyhpfueru(); // 敌人回血
        this.damagePlayer();
    }

    // --- 绿色复杂逻辑 (对应 iro3sentou) ---
    // 核心机制：生命平分 (Life Averaging)
    // 1. 统计敌人和玩家的总血量 (midoriheartkazu)。
    // 2. 清除双方原有的血条。
    // 3. 将总血量除以 2。
    // 4. 根据双方原本血条的"基底类型" (10x, 11x, 12x, 131)，重新生成平分后的血条。
    mechanicGreen_Complex(ex, ey) {
        let midoriheartkazu = 0; // 总血量计数器
        let akaheartichi = 0;    // 类型状态机 (0:初始, 1:10x, 2:11x, 3:12x, 4:131)

        const px = this.state.player.x;
        const py = this.state.player.y;

        // ==========================================
        // 步骤 1: 统计敌人HP 并 清除
        // ==========================================
        let hpy = ey;
        while (true) {
            hpy++;
            if (hpy >= 14) break;

            // 读取原始数据 (Foreground)
            let id = this.state.gridForeground[ex][hpy];

            if (!((id >= 101) && (id <= 131))) break; // 不是血条，停止

            if (id >= 131) { // 131 (hm)
                if (akaheartichi !== 4 && akaheartichi !== 0) break;
                akaheartichi = 4;
                midoriheartkazu++; // 阻挡块算 1 分
                this.state.gridBuffer[ex][hpy] = 0; // 清除
            }
            else if (id >= 120) { // 12x
                if (akaheartichi !== 3 && akaheartichi !== 0) break;
                akaheartichi = 3;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[ex][hpy] = 0; // 清除
                if (id % 10 !== 3) break; // 不是满血(3)，说明是末端
            }
            else if (id >= 110) { // 11x
                if (akaheartichi !== 2 && akaheartichi !== 0) break;
                akaheartichi = 2;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[ex][hpy] = 0; // 清除
                if (id % 10 !== 3) break;
            }
            else { // 10x
                if (akaheartichi !== 1 && akaheartichi !== 0) break;
                akaheartichi = 1;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[ex][hpy] = 0; // 清除
                if (id % 10 !== 3) break;
            }
        }

        // ==========================================
        // 步骤 2: 统计主角HP 并 清除
        // ==========================================
        hpy = py;
        akaheartichi = 0; // 重置状态机
        while (true) {
            hpy++;
            if (hpy >= 14) break;

            let id = this.state.gridForeground[px][hpy];

            if (!((id >= 101) && (id <= 131))) break;

            if (id === 131) {
                if (akaheartichi !== 4 && akaheartichi !== 0) break;
                akaheartichi = 4;
                midoriheartkazu++;
                this.state.gridBuffer[px][hpy] = 0;
            }
            else if (id >= 120) {
                if (akaheartichi !== 3 && akaheartichi !== 0) break;
                akaheartichi = 3;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            }
            else if (id >= 110) {
                if (akaheartichi !== 2 && akaheartichi !== 0) break;
                akaheartichi = 2;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            }
            else {
                if (akaheartichi !== 1 && akaheartichi !== 0) break;
                akaheartichi = 1;
                midoriheartkazu += (id % 10);
                this.state.gridBuffer[px][hpy] = 0;
                if (id % 10 !== 3) break;
            }
        }

        // ==========================================
        // 步骤 3: 计算平分后的血量
        // ==========================================
        midoriheartkazu = Math.floor(midoriheartkazu / 2);

        let midorihearthaichi = midoriheartkazu;  // 主角分配到的
        let midorihearthaichi2 = midoriheartkazu; // 敌人分配到的

        // ==========================================
        // 步骤 4: 确定双方的"基底类型"
        // ==========================================
        // 逻辑：检查原来紧贴着双方的第一格血条是什么类型
        // 从而决定重建出来的血条是什么颜色 (保持原样)

        hpy = py; // 主角位置

        // 检查主角侧基底
        // akaheartichi 在这里复用为"类型偏移量" (0, 10, 20, 30)
        let firstPlayerHeart = this.state.gridForeground[px][hpy + 1];
        if (firstPlayerHeart === 131) akaheartichi = 30;
        else if (firstPlayerHeart >= 120 && firstPlayerHeart <= 130) akaheartichi = 20;
        else if (firstPlayerHeart >= 110 && firstPlayerHeart <= 120) akaheartichi = 10;
        else akaheartichi = 0;

        // 检查敌人侧基底
        let tekiheartichi = 0;
        let firstEnemyHeart = this.state.gridForeground[ex][ey + 1]; // ey 是敌人Y
        if (firstEnemyHeart === 131) tekiheartichi = 30;
        else if (firstEnemyHeart >= 120 && firstEnemyHeart <= 130) tekiheartichi = 20;
        else if (firstEnemyHeart >= 110 && firstEnemyHeart <= 120) tekiheartichi = 10;
        else tekiheartichi = 0;

        // ==========================================
        // 步骤 5: 重建血条 (Rebuild)
        // ==========================================

        // 我们利用一个循环同时重建两边，或者直到两边都填完
        // 源码逻辑是写在一个大的 while(true) 里同时处理

        hpy = py; // 从 Y+1 开始填 (注意：这里假设 ex 和 px 在同一行？不一定)
        // 修正：原代码逻辑中 hpy 是通用的，意味着它假设主角和敌人处于同一水平线上，
        // 或者它只是用 hpy 作为相对偏移量？
        // 原代码：hpy = heroiney; ... loop hpy++ ... arumonoidougo[heroinex, hpy] ... arumonoidougo[battlex, hpy]
        // 【重要发现】：原代码确实假设 ex 和 px 共享同一个相对 Y 轴填充逻辑。
        // 但如果敌人在 Y=5，玩家在 Y=8，直接用同一个 hpy 会导致敌人血条画错位置。
        // 不过看 battle 调用处，并没有强制 ey == py。
        // 但 C# 源码确实重置了 hpy = heroiney 然后同时填两边。
        // 这可能是一个 Bug 或者游戏设定（敌人和玩家总是上下对齐战斗？）。
        // 为了保险，我将把 ex 和 px 的填充逻辑 **分离坐标**，但逻辑保持一致。

        let targetY_Player = py;
        let targetY_Enemy = ey;

        while (true) {
            targetY_Player++;
            targetY_Enemy++;

            // 只要没到底(14)，就尝试填充
            if (targetY_Player >= 14) break;
            // 注意：这里没有单独检查 Enemy 越界，因为原逻辑也没检查，我们加个保险
            let enemyOutOfBounds = (targetY_Enemy >= 14);

            // --- 重建主角侧 ---
            if (akaheartichi === 30) { // 131 类型
                if (midorihearthaichi >= 1) {
                    if (this.state.gridBuffer[px][targetY_Player] === 0) {
                        this.state.gridBuffer[px][targetY_Player] = 131;
                        midorihearthaichi--;
                    } else midorihearthaichi = 0;
                }
            }
            else if (midorihearthaichi >= 4) { // 满血 (3分)
                if (this.state.gridBuffer[px][targetY_Player] === 0 && akaheartichi >= 0) {
                    this.state.gridBuffer[px][targetY_Player] = 103 + akaheartichi;
                } else midorihearthaichi = 0;
                midorihearthaichi -= 3;
            }
            else if (midorihearthaichi >= 1) { // 残血 (1-2分)
                if (this.state.gridBuffer[px][targetY_Player] === 0) {
                    this.state.gridBuffer[px][targetY_Player] = 100 + midorihearthaichi + akaheartichi;
                    midorihearthaichi = 0;
                } else midorihearthaichi = 0;
            }

            // --- 重建敌人侧 ---
            if (!enemyOutOfBounds) {
                if (tekiheartichi === 30) { // 131 类型
                    if (midorihearthaichi2 >= 1) {
                        if (this.state.gridBuffer[ex][targetY_Enemy] === 0) {
                            this.state.gridBuffer[ex][targetY_Enemy] = 131;
                            midorihearthaichi2--;
                        } else midorihearthaichi2 = 0;
                    }
                }
                else if (midorihearthaichi2 >= 4) { // 满血
                    if (this.state.gridBuffer[ex][targetY_Enemy] === 0 && tekiheartichi >= 0) {
                        this.state.gridBuffer[ex][targetY_Enemy] = 103 + tekiheartichi;
                    } else midorihearthaichi2 = 0;
                    midorihearthaichi2 -= 3;
                }
                else if (midorihearthaichi2 >= 1) { // 残血
                    if (this.state.gridBuffer[ex][targetY_Enemy] === 0) {
                        this.state.gridBuffer[ex][targetY_Enemy] = 100 + midorihearthaichi2 + tekiheartichi;
                        midorihearthaichi2 = 0;
                    } else midorihearthaichi2 = 0;
                }
            }

            // 如果两边都没血分了，提前退出
            if (midorihearthaichi <= 0 && midorihearthaichi2 <= 0) break;
        }
    }

    mechanicYellow_Simple(ex, ey) { // e4
        this.enemyhpfueru();
        this.enemyhpfueru(); // 敌人回2次
        this.damagePlayer();
    }

    // --- 黄色复杂逻辑 (对应 iro4sentou) ---
    // 核心机制：变形 (Transform)。玩家扣血，然后根据方向改变剩余血条的类型。
    mechanicYellow_Complex(ex, ey) {
        // 1. 敌人受伤 (标准)
        this.damageEnemy(ex, ey);

        // 2. 玩家血条变形
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py;
        let akaheartichi = 0;
        let dir = this.state.player.dir; // 3=Right

        while (true) {
            hpy++;
            if (hpy >= 14) break;
            let id = this.state.gridBuffer[px][hpy]; // 读 Buffer
            if (id < 101 || id > 123) break; // 只处理普通血条

            if (id >= 120) {
                if (akaheartichi !== 3 && akaheartichi !== 0) break;
                akaheartichi = 3;
                // 12x -> 10x
                if (dir !== 3) this.state.gridBuffer[px][hpy] = id - 20;
                if (id % 10 !== 3) break;
            }
            else if (id >= 110) {
                if (akaheartichi !== 2 && akaheartichi !== 0) break;
                akaheartichi = 2;
                // 11x -> 10x (Right)
                if (dir === 3) this.state.gridBuffer[px][hpy] = id - 10;
                if (id % 10 !== 3) break;
            }
            else {
                if (akaheartichi !== 1 && akaheartichi !== 0) break;
                akaheartichi = 1;
                // 10x -> 12x (Right) 或 11x (Other)
                if (dir === 3) this.state.gridBuffer[px][hpy] = id + 20;
                else this.state.gridBuffer[px][hpy] = id + 10;

                if (id % 10 !== 3) break;
            }
        }
    }

    mechanicHypno(ex, ey) { // e5
        this.damageEnemy(ex, ey);
        this.heroinehptobasu(); // 击飞
    }
}