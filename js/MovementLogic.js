// MovementLogic.js
class MovementLogic {
    constructor(gameState, battleLogic) {
        this.state = gameState;
        this.battle = battleLogic;
        // [新增] 动作冷却时间戳
        this.lastActionTime = 0;
    }
    processMoveInput(dx, dy) {
        if (this.state.gameStatus !== 0) return;

        // [冷却] 非回放模式限制手速
        if (!this.state.isReplayMode) {
            const now = Date.now();
            if (now - this.lastActionTime < 100) return;
            this.lastActionTime = now;
        }

        // 1. 确定方向 & 更新角色朝向 (Dir)
        // 规则：下->左, 上->右
        // 注意：这里只更新朝向，不决定变色，变色由前后差异决定
        const oldDir = this.state.player.dir;
        let newDir = oldDir;
        let dousahoukou = 0;

        if (dy === 1) { 
            newDir = DIR.RIGHT; // 上 -> 面朝右
            dousahoukou = 1; 
        }
        else if (dy === -1) { 
            newDir = DIR.LEFT;  // 下 -> 面朝左
            dousahoukou = 4; 
        }
        else if (dx === -1) { 
            newDir = DIR.LEFT;  // 左 -> 面朝左
            dousahoukou = 2; 
        }
        else if (dx === 1) { 
            newDir = DIR.RIGHT; // 右 -> 面朝右
            dousahoukou = 3; 
        }

        // 2. 保存快照 & 准备 (在更新方向之前保存，确保回溯能恢复到移动前的完整状态)
        this.state.saveSnapshot();
        this.state.syncMainToBuffer();

        // 更新方向
        this.state.player.dir = newDir;

        // 3. 【变色逻辑】(Pre-Move Transformation)
        // 触发条件：粉发(Form 2) 且 发生了转身
        let transformed = false;
        if (this.state.playerForm === 2) {
            if (oldDir !== newDir) {
                // 只有转身时才变色 (Blue <-> Yellow)
                transformed = this.processHpHanten();
                // console.log("Turned -> Colors Swapped");
            }
        }

        // 4. 【移动逻辑】
        // 此时 Foreground 可能已经被 processHpHanten 修改过了
        // move 函数负责把 Foreground 的东西搬到 Buffer 的新位置
        let moved = false;
        if (dousahoukou === 2) moved = this.moveLeft();
        else if (dousahoukou === 1) moved = this.moveUp();
        else if (dousahoukou === 4) moved = this.moveDown();
        else if (dousahoukou === 3) moved = this.moveRight();

        // 5. 结算
        if (moved || transformed) {
            this.state.stepCount++;
            
            if (!this.state.isReplayMode) {
                let char = '';
                if (dy === 1) char = 'U';
                else if (dy === -1) char = 'D';
                else if (dx === -1) char = 'L';
                else if (dx === 1) char = 'R';
                this.state.replayString += char;
            }

            // 地板触发器 (仅当物理移动时)
            if (moved) {
                const px = this.state.player.x;
                const py = this.state.player.y;
                const floorId = this.state.gridBackground[px][py];
                
                // 变色地板
                if (floorId >= 11 && floorId <= 16) {
                    const targetColor = floorId - 10;
                    if (this.state.colorTheme !== targetColor) {
                        this.state.colorTheme = targetColor;
                    }
                }
                // 变身地板逻辑 ...
                this.checkFloorTrigger();
            }

            this.checkWinLoss();
            this.state.syncBufferToMain(); 

        } else {
            this.state.restoreSnapshot(); // 恢复数据
        }
    }

    //   核心复刻：hpichi 状态机循环

    moveUp() {
        const hx = this.state.player.x;
        const hy = this.state.player.y;
        if (hy >= 13) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 0, 1);
        const targetId = this.state.gridBuffer[hx][hy + 1];

        if (targetId === ID.EMPTY) {
            let stackY = hy + 1; 
            let hpichi = 0; 
            while (stackY < 14) {
                const id = this.state.gridForeground[hx][stackY]; // 读旧帧
                if (id < 101 || id > 200) break;
                const type = Math.floor(id / 10); 
                if (hpichi === 2 && type !== 10) break;
                if (hpichi === 1 && type !== 11) break;
                if (hpichi === 3 && type !== 12) break;
                if (hpichi === 4 && id !== 131) break;

                if (this.state.gridBuffer[hx][stackY + 1] === 0) {
                    this.state.gridBuffer[hx][stackY + 1] = id;
                    this.state.gridBuffer[hx][stackY] = 0;
                } else break;

                if (id === 103) hpichi = 2;
                else if (id === 113) hpichi = 1;
                else if (id === 123) hpichi = 3;
                else if (id === 131) hpichi = 4;
                else break;
                stackY++;
            }
            this.state.gridBuffer[hx][hy + 1] = 1; 
            this.state.gridBuffer[hx][hy] = 0;     
            this.state.player.y++;
            return true;
        } else if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx, hy + 1, 0, 1);
            return true;
        }
        return false;
    }

    moveDown() {
        const hx = this.state.player.x;
        const hy = this.state.player.y;
        if (hy <= 0) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 0, -1);
        const targetId = this.state.gridBuffer[hx][hy - 1];

        if (targetId === ID.EMPTY) {
            this.state.gridBuffer[hx][hy - 1] = 1;
            this.state.gridBuffer[hx][hy] = 0;
            this.state.player.y--;

            let stackY = hy + 1;
            let hpichi = 0;
            while (stackY < 14) {
                const id = this.state.gridForeground[hx][stackY];
                if (id < 101 || id > 200) break;
                const type = Math.floor(id / 10);
                if (hpichi === 2 && type !== 10) break;
                if (hpichi === 1 && type !== 11) break;
                if (hpichi === 3 && type !== 12) break;
                if (hpichi === 4 && id !== 131) break;

                if (this.state.gridBuffer[hx][stackY - 1] === 0) {
                    this.state.gridBuffer[hx][stackY - 1] = id;
                    this.state.gridBuffer[hx][stackY] = 0;
                } else break;

                if (id === 103) hpichi = 2;
                else if (id === 113) hpichi = 1;
                else if (id === 123) hpichi = 3;
                else if (id === 131) hpichi = 4;
                else break;
                stackY++;
            }
            return true;
        } else if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx, hy - 1, 0, -1);
            return true;
        }
        return false;
    }

    moveLeft() {
        const hx = this.state.player.x;
        const hy = this.state.player.y;
        if (hx <= 0) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, -1, 0);
        
        const targetId = this.state.gridBuffer[hx - 1][hy];

        if (targetId === ID.EMPTY) {
            this.state.gridBuffer[hx - 1][hy] = 1;
            this.state.gridBuffer[hx][hy] = 0;
            this.state.player.x--;

            let stackY = hy + 1;
            let hpichi = 0;
            while (stackY < 14) {
                const id = this.state.gridForeground[hx][stackY];
                if (id < 101 || id > 200) break;
                const type = Math.floor(id / 10);
                if (hpichi === 2 && type !== 10) break;
                if (hpichi === 1 && type !== 11) break;
                if (hpichi === 3 && type !== 12) break;
                if (hpichi === 4 && id !== 131) break;

                if (this.state.gridBuffer[hx - 1][stackY] === 0) {
                    this.state.gridBuffer[hx - 1][stackY] = id;
                    this.state.gridBuffer[hx][stackY] = 0;
                } else break;

                if (id === 103) hpichi = 2;
                else if (id === 113) hpichi = 1;
                else if (id === 123) hpichi = 3;
                else if (id === 131) hpichi = 4;
                else break;
                stackY++;
            }
            // 【修正】这里绝对不能再调用 transformStack！
            return true;
        } else if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx - 1, hy, -1, 0);
            return true;
        }
        return false;
    }

    moveRight() {
        const hx = this.state.player.x;
        const hy = this.state.player.y;
        if (hx >= 13) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 1, 0);
        
        const targetId = this.state.gridBuffer[hx + 1][hy];

        if (targetId === ID.EMPTY) {
            this.state.gridBuffer[hx + 1][hy] = 1;
            this.state.gridBuffer[hx][hy] = 0;
            this.state.player.x++;

            let stackY = hy + 1;
            let hpichi = 0;
            while (stackY < 14) {
                const id = this.state.gridForeground[hx][stackY];
                if (id < 101 || id > 200) break;
                const type = Math.floor(id / 10);
                if (hpichi === 2 && type !== 10) break;
                if (hpichi === 1 && type !== 11) break;
                if (hpichi === 3 && type !== 12) break;
                if (hpichi === 4 && id !== 131) break;

                if (this.state.gridBuffer[hx + 1][stackY] === 0) {
                    this.state.gridBuffer[hx + 1][stackY] = id;
                    this.state.gridBuffer[hx][stackY] = 0;
                } else break;

                if (id === 103) hpichi = 2;
                else if (id === 113) hpichi = 1;
                else if (id === 123) hpichi = 3;
                else if (id === 131) hpichi = 4;
                else break;
                stackY++;
            }
            // 【修正】这里绝对不能再调用 transformStack！
            return true;
        } else if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx + 1, hy, 1, 0);
            return true;
        }
        return false;
    }

    // --- 2. 粉发换心逻辑 (双写修正版) ---
    // --- 粉发换心 (hphanten) - 保持双写逻辑 ---
    processHpHanten() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py + 1;
        let hpichi = 0; 
        let hasChanged = false;
        const foreground = this.state.gridForeground;

        while (true) {
            if (hpy >= 14) break;
            const id = foreground[px][hpy];

            if (id < 101 || id > 200 || id === 131) break;
            if (id >= 101 && id <= 103) break; // Red stops

            // 11x (Blue) <-> 12x (Yellow)
            // 满血互换
            if (id === 123 && hpichi !== 1) { 
                this.applyHanten(px, hpy, 113); hpichi = 3; hasChanged = true; hpy++; continue; 
            }
            if (id === 113 && hpichi !== 3) { 
                this.applyHanten(px, hpy, 123); hpichi = 1; hasChanged = true; hpy++; continue; 
            }

            // 残血互换 (终结)
            if (id === 122 && hpichi !== 1) { this.applyHanten(px, hpy, 112); hasChanged = true; return true; }
            if (id === 121 && hpichi !== 1) { this.applyHanten(px, hpy, 111); hasChanged = true; return true; }
            
            if (id === 112 && hpichi !== 3) { this.applyHanten(px, hpy, 122); hasChanged = true; return true; }
            if (id === 111 && hpichi !== 3) { this.applyHanten(px, hpy, 121); hasChanged = true; return true; }

            // 没匹配上，断开
            if (!((id === 113) && (hpichi !== 3)) && !((id === 123) && (hpichi !== 1))) break;
        }
        return hasChanged;
    }

    applyHanten(x, y, newId) {
        this.state.gridBuffer[x][y] = newId;
        this.state.gridForeground[x][y] = newId; 
    }


    // 返回值：boolean (是否有变化)
    // processHpHanten() {
    //     const px = this.state.player.x;
    //     const py = this.state.player.y;
    //     let hpy = py + 1;

    //     // hpichi 状态机：防止连锁反应
    //     // 0: 初始
    //     // 1: 刚把黄变蓝 (期待下一个是黄)
    //     // 3: 刚把蓝变黄 (期待下一个是蓝)
    //     let hpichi = 0;

    //     let hasChanged = false;
    //     const grid = this.state.gridBuffer;

    //     while (true) {
    //         if (hpy >= 14) break;
    //         const id = grid[px][hpy];

    //         // 遇到非心、金心、红心(10x) -> 停止
    //         if (id < 101 || id > 200 || id === 131) break;
    //         if (id >= 101 && id <= 103) break; // Red stops chain

    //         // 1. 黄满(123) -> 蓝满(113)
    //         // hpichi != 1 意味着下面那个没变，或者下面那个是从蓝变黄的(3)
    //         // 只有当"期待黄"(0或3)时才变
    //         if (id === 123 && hpichi !== 1) {
    //             grid[px][hpy] = 113;
    //             hpichi = 3;
    //             hasChanged = true;
    //             hpy++;
    //             continue;
    //         }

    //         // 2. 黄2(122) -> 蓝2(112) [结束]
    //         if (id === 122 && hpichi !== 1) {
    //             grid[px][hpy] = 112;
    //             hasChanged = true;
    //             return true;
    //         }

    //         // 3. 黄1(121) -> 蓝1(111) [结束]
    //         if (id === 121 && hpichi !== 1) {
    //             grid[px][hpy] = 111;
    //             hasChanged = true;
    //             return true;
    //         }

    //         // 4. 蓝满(113) -> 黄满(123)
    //         if (id === 113 && hpichi !== 3) {
    //             grid[px][hpy] = 123;
    //             hpichi = 1;
    //             hasChanged = true;
    //             hpy++;
    //             continue;
    //         }

    //         // 阻断判定：如果颜色没对上 (例如下面刚变黄(hpichi=1)，上面却是黄(123))
    //         // 123 != 113 (Fail) -> break
    //         if (!((id === 113) && (hpichi !== 3))) {
    //             break;
    //         }
    //     }

    //     // 循环外补漏 (处理蓝残血)
    //     if (hpy < 14) {
    //         const lastId = grid[px][hpy];
    //         // 蓝2 -> 黄2
    //         if (lastId === 112 && hpichi !== 3) {
    //             grid[px][hpy] = 122;
    //             hasChanged = true;
    //         }
    //         // 蓝1 -> 黄1
    //         else if (lastId === 111 && hpichi !== 3) {
    //             grid[px][hpy] = 121;
    //             hasChanged = true;
    //         }
    //     }

    //     return hasChanged;
    // }
    // processMoveInput(dx, dy) {
    //         if (this.state.gameStatus !== 0) return;

    //         // [新增] 冷却检查
    //         if (!this.state.isReplayMode) {
    //             const now = Date.now();
    //             if (now - this.lastActionTime < 100) return; 
    //             this.lastActionTime = now;
    //         }

    //         // 1. 确定方向 & 目标颜色
    //         let dousahoukou = 0;
    //         let targetColorPrefix = 0; // 0:不变, 11:黄, 12:蓝

    //         if (dy === 1) { 
    //             this.state.player.dir = DIR.UP; 
    //             dousahoukou = 1; 
    //             // 上移 -> 视为右转(黄)
    //             if (this.state.playerForm === 2) targetColorPrefix = 11;
    //         }
    //         else if (dx === -1) { 
    //             this.state.player.dir = DIR.LEFT; 
    //             dousahoukou = 2; 
    //             // 左移 -> 蓝
    //             if (this.state.playerForm === 2) targetColorPrefix = 12;
    //         }
    //         else if (dx === 1) { 
    //             this.state.player.dir = DIR.RIGHT; 
    //             dousahoukou = 3; 
    //             // 右移 -> 黄
    //             if (this.state.playerForm === 2) targetColorPrefix = 11;
    //         }
    //         else if (dy === -1) { 
    //             this.state.player.dir = DIR.DOWN; 
    //             dousahoukou = 4; 
    //             // 下移 -> 视为左转(蓝)
    //             if (this.state.playerForm === 2) targetColorPrefix = 12;
    //         }

    //         // [修正] 彻底删除粉发向上拦截！
    //         // 让 moveUp 内部的物理逻辑去决定能不能走

    //         // 2. 保存快照 & 准备
    //         this.state.saveSnapshot();
    //         this.state.syncMainToBuffer();

    //         // 3. 尝试物理移动
    //         let moved = false;
    //         if (dousahoukou === 2) moved = this.moveLeft();
    //         else if (dousahoukou === 1) moved = this.moveUp();
    //         else if (dousahoukou === 4) moved = this.moveDown();
    //         else if (dousahoukou === 3) moved = this.moveRight();

    //         // 4. 尝试变色 (即使没移动，只要是粉发且有方向输入，就尝试变色)
    //         // 注意：如果 moved 为 true，player坐标已更新，transformStack 会作用于新位置
    //         // 如果 moved 为 false，player坐标未变，transformStack 作用于原地
    //         let transformed = false;
    //         if (this.state.playerForm === 2 && targetColorPrefix !== 0) {
    //             transformed = this.transformStack(targetColorPrefix);
    //         }

    //         // 5. 结算：只要发生过移动 OR 发生了变色，就算有效操作
    //         if (moved || transformed) {
    //             this.state.stepCount++;

    //             // 录像记录
    //             if (!this.state.isReplayMode) {
    //                 let char = '';
    //                 if (dy === 1) char = 'U';
    //                 else if (dy === -1) char = 'D';
    //                 else if (dx === -1) char = 'L';
    //                 else if (dx === 1) char = 'R';
    //                 this.state.replayString += char;
    //             }

    //             // 触发器与胜负
    //             // 只有移动了才需要检查地板触发器? 
    //             // 不，变色可能导致某些依赖颜色的逻辑变化，虽然地板触发通常依赖位置改变
    //             if (moved) {
    //                 // 地板变色逻辑 (c1-c6)
    //                 const px = this.state.player.x;
    //                 const py = this.state.player.y;
    //                 const floorId = this.state.gridBackground[px][py];
    //                 if (floorId >= 11 && floorId <= 16) {
    //                     const targetColor = floorId - 10;
    //                     if (this.state.colorTheme !== targetColor) {
    //                         this.state.colorTheme = targetColor;
    //                     }
    //                 }

    //                 // 变身逻辑 (cs/ce)
    //                 this.checkFloorTrigger(); // 假设你封装了这个函数，或者把上面的代码放进去
    //             }

    //             this.checkWinLoss();
    //             this.state.syncBufferToMain();

    //         } else {
    //             // 既没动，也没变色 (撞墙且不需要变色，或者变色前后颜色一样)
    //             // 撤销快照，不计步数
    //             this.state.history.pop();
    //         }
    //     }
    // processMoveInput(dx, dy) {
    //     if (this.state.gameStatus !== 0) return;
    //     // [新增] 冷却检查 (0.1s = 100ms)
    //     // 只有非回放模式才限制手速，回放模式由计时器控制
    //     if (!this.state.isReplayMode) {
    //         const now = Date.now();
    //         if (now - this.lastActionTime < 100) {
    //             return; // 冷却中，忽略输入
    //         }
    //         this.lastActionTime = now; // 更新时间
    //     }

    //     let dousahoukou = 0;
    //     if (dy === 1) { this.state.player.dir = DIR.UP; dousahoukou = 1; }
    //     else if (dx === -1) { this.state.player.dir = DIR.LEFT; dousahoukou = 2; }
    //     else if (dx === 1) { this.state.player.dir = DIR.RIGHT; dousahoukou = 3; }
    //     else if (dy === -1) { this.state.player.dir = DIR.DOWN; dousahoukou = 4; }

    //     //if (this.state.playerForm === 2 && dousahoukou === 1) return;
    //     //粉色女主向上是可以的，前提是无心
    //     // 1. 【新增】在一切修改之前，保存快照！
    //     this.state.saveSnapshot();
    //     this.state.syncMainToBuffer();

    //     let actionOccurred = false;
    //     if (dousahoukou === 2) actionOccurred = this.moveLeft();
    //     else if (dousahoukou === 1) actionOccurred = this.moveUp();
    //     else if (dousahoukou === 4) actionOccurred = this.moveDown();
    //     else if (dousahoukou === 3) actionOccurred = this.moveRight();

    //     if (actionOccurred) {
    //         // 3. 【新增】记录步数和录像
    //         this.state.stepCount++;
    //         // 简单的录像字符映射
    //         // [修正] 只有非回放模式才记录录像
    //         if (!this.state.isReplayMode) {
    //             let char = '';
    //             if (dy === 1) char = 'U';
    //             else if (dy === -1) char = 'D';
    //             else if (dx === -1) char = 'L';
    //             else if (dx === 1) char = 'R';
    //             this.state.replayString += char;
    //         }
    //         this.checkFloorTrigger();
    //         this.checkWinLoss();
    //         const px = this.state.player.x;
    //         const py = this.state.player.y;
    //         const floorId = this.state.gridBackground[px][py];
    //         this.state.syncBufferToMain();
    //         if (floorId >= 11 && floorId <= 16) {
    //             // 计算目标颜色
    //             const targetColor = floorId - 10; // 11->1, 16->6

    //             // 如果颜色不同，则切换
    //             if (this.state.colorTheme !== targetColor) {
    //                 this.state.colorTheme = targetColor;
    //                 console.log(`Color Changed to: ${targetColor}`);
    //             }
    //         }
    //     } else {
    //         // 如果动作没发生(撞墙)，弹出刚才存的无用快照，节省内存
    //         this.state.history.pop();
    //     }
    // }
    // --- [新增方法] 检查地板触发器 (变身 & 灰魔像封印) ---
    checkFloorTrigger() {
        const px = this.state.player.x;
        const py = this.state.player.y;

        // 读取背景层 (地板 ID)
        const floorId = this.state.gridBackground[px][py];

        // 只有 ID 2 (cs/银) 和 ID 3 (ce/粉) 是变身地板
        if (floorId !== 2 && floorId !== 3) return;

        // --- Stage 93 灰魔像封印检查 ---
        // 逻辑：如果是 93 关，且坐标 (3, 1) 上的物体是 ID 26 (灰魔像)，则禁止变身
        if (this.state.currentStageId === "93") {
            // 检查 Buffer，因为魔像可能刚刚被推走或打死
            // 坐标 (3, 1) 对应: x=3, y=1 (从下往上数第2行)
            if (this.state.gridBuffer[3][1] !== 26) {
                console.log("Magic sealed by Gray Golem!");
                return; // 封印生效，直接返回，不执行变身
            }
        }

        // --- 执行变身 ---
        if (floorId === 2) {
            // 踩到 cs -> 变银发 (Form 1)
            if (this.state.playerForm !== 1) {
                this.state.playerForm = 1;
                console.log("Transformed to Silver (Form 1)");
                // 更新网页图标
                if (window.updateFavicon) window.updateFavicon(1);
            }
        }
        else if (floorId === 3) {
            // 踩到 ce -> 变粉发 (Form 2)
            if (this.state.playerForm !== 2) {
                this.state.playerForm = 2;
                console.log("Transformed to Pink (Form 2)");
                // 更新网页图标
                if (window.updateFavicon) window.updateFavicon(2);
            }
        }
    }



    // --- 推箱子 (修复检测起点) ---
    processPush(startX, startY, dx, dy) {
        let pushX = startX + dx; // 必须+dx!
        let pushY = startY + dy;
        let canPush = false;

        while (this.isValid(pushX, pushY)) {
            let id = this.state.gridForeground[pushX][pushY];
            if (id === ID.EMPTY) { canPush = true; break; }
            if (!this.isPushable(id)) { canPush = false; break; }
            pushX += dx;
            pushY += dy;
        }

        if (canPush) {
            while (pushX !== (startX + dx) || pushY !== (startY + dy)) {
                let prevX = pushX - dx;
                let prevY = pushY - dy;
                this.state.gridBuffer[pushX][pushY] = this.state.gridForeground[prevX][prevY];
                pushX = prevX;
                pushY = prevY;
            }
            this.state.gridBuffer[pushX][pushY] = 0;
        }
    }
    checkWinLoss() {
        if (this.state.gameStatus !== 0) return;

        let playerFound = false;
        let enemyExists = false;
        let px = -1, py = -1;

        // 1. 全图扫描
        for (let x = 0; x < 14; x++) {
            for (let y = 0; y < 14; y++) {
                const id = this.state.gridBuffer[x][y];

                // 找主角
                if (id === 1) {
                    playerFound = true;
                    px = x; py = y;
                }

                if (id >= 11 && id <= 26) {
                    // 处决逻辑检查
                    let hasHeart = false;
                    if (y < 13) {
                        const hId = this.state.gridBuffer[x][y + 1];
                        if (hId >= 101 && hId <= 200) hasHeart = true;
                    }
                     // A. 僵尸 (17, 18)
                    if (id === 17 || id === 18) {
                        enemyExists = true; 
                        if (hasHeart) {
                            if (id === 18) this.state.gridBuffer[x][y] = 25; // 18 复活为 25
                            else if (id === 17) this.state.gridBuffer[x][y] = 16;
                        }
                    }
                    
                    // B. 活体怪物 (包括 25)
                    else {
                        if (hasHeart) {
                            enemyExists = true;
                        } else {
                            // 【关键】ID 25 在这里如果不幸头顶没心 (被推掉)，
                            // 因为它现在 ID 是 25 而不是 18，所以会进入这里 -> 处决！
                            // 这就修复了你的 Bug。
                            
                            this.state.gridBuffer[x][y] = 0; 
                            this.state.effects.push({
                                x: x, y: y, startTime: Date.now(),
                                type: 'DIE', id: id, form: this.state.playerForm, isCrushed: true,
                                color: this.state.colorTheme
                            });
                        }
                    }
                }
            }
        }

        // 2. 主角判定
        if (playerFound) {
            // 计算 check
            let check = 1;
            if (this.state.isInvincible === 1) check = 2;

            // 检查头顶心
            let hasHeart = false;
            if (py < 13) {
                const hId = this.state.gridBuffer[px][py + 1];
                if (hId >= 101 && hId <= 200) hasHeart = true;
            }

            // 分支 A: 无敌 (Check=2)
            if (check === 2) {
                // 如果有心，解除无敌
                if (hasHeart) {
                    this.state.isInvincible = 0;
                    console.log(`[System] Fujimi Lost at (${px},${py}) - Heart Restored`);
                }
                // 无敌状态下，无论有没有心，本帧都不死
            }
            // 分支 B: 凡人 (Check=1)
            else if (check === 1) {
                if (!hasHeart) {
                    // 处决
                    this.state.gridBuffer[px][py] = 0;
                    playerFound = false; // 标记死亡
                    this.state.gameStatus = 2;
                    console.log("[System] Player Died (Starved)");

                    this.state.effects.push({
                        x: px, y: py, startTime: Date.now(),
                        type: 'DIE', id: 1, form: this.state.playerForm, isCrushed: true
                    });
                }
            }
        } else {
            // 主角本体都没了
            this.state.gameStatus = 2;
        }

        // 3. 结算
        if (this.state.gameStatus === 0 && !enemyExists) {
            this.state.gameStatus = 1; // WIN
            console.log("Stage Clear!");
            if (typeof saveSystem !== 'undefined') {
                const saveKey = this.state.currentLevelKey || this.state.currentStageId;
                saveSystem.submitResult(saveKey, this.state.stepCount, this.state.replayString);
            }
        }
    }


    transformStack(targetPrefix) {
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py + 1;
        const grid = this.state.gridBuffer;

        let hasChanged = false; // [新增] 标记是否有数据变更

        while (hpy < 14) {
            const id = grid[px][hpy];

            if (id < 101 || id > 200) break;
            if (id === 131) break;

            // 红心 (10x) 不变色，但也阻断传导
            if (id >= 101 && id <= 103) {
                break;
            }

            const currentPrefix = Math.floor(id / 10);
            const hp = id % 10;

            // 如果当前颜色已经和目标一致，就不需要写入，但可能需要继续往上检查断链
            // 为了简单且符合原版"刷漆"逻辑，我们只有在颜色不同时才写入

            if (currentPrefix !== targetPrefix) {
                // 只有当颜色不同时，才算作改变
                hasChanged = true;
            }

            if (hp === 3) {
                // 变色
                grid[px][hpy] = targetPrefix * 10 + 3;

                // 检查下一格连通性
                if (hpy + 1 < 14) {
                    const nextId = grid[px][hpy + 1];
                    if (nextId >= 101 && nextId <= 200 && nextId !== 131) {
                        const nextPrefix = Math.floor(nextId / 10);
                        // 比较对象是"旧的当前层"前缀
                        if (nextPrefix !== currentPrefix) {
                            return hasChanged; // 断开
                        }
                    }
                }
                hpy++;
                continue;
            }

            if (hp === 2 || hp === 1) {
                grid[px][hpy] = targetPrefix * 10 + hp;
                return true; // 只要到了这一步，肯定变了 (因为前面 currentPrefix !== targetPrefix 没拦住，或者拦住了但这里赋值)
                // 严谨写法: return hasChanged; 
            }

            break;
        }
        return hasChanged;
    }

    isValid(x, y) { return x >= 0 && x < 14 && y >= 0 && y < 14; }
    isPushable(id) { return (id >= 100 && id <= 399) || (id >= 400); }
    isEnemy(id) { return id >= 11 && id <= 26; }
}