// GameState.js
class GameState {
    constructor() {
        this.gridSize = 14;

        // 双缓冲系统：Foreground 是当前帧，Buffer 是计算中的下一帧
        this.gridForeground = this.createGrid();
        this.gridBuffer = this.createGrid();
        this.gridBackground = this.createGrid();
        this.gridTexture = this.createGrid(); // moyou

        this.player = { x: 0, y: 0, dir: DIR.RIGHT };

        // 游戏规则状态
        this.playerForm = 2;   // 默认形态2（雪莉）
        this.colorTheme = 0;   // spriteiro
        this.isInvincible = 0; // fujimi

        // 游戏结果状态 (0:进行中, 1:胜, 2:负)
        this.gameStatus = 0;
        // --- [新增] ---
        this.effects = [];   // 存储爆炸对象:  现在: { x, y, startTime, type, form, isCrushed }
        this.animTick = 0;   // 全局动画计时: 0~60 循环
        this.currentStageId = "1"; // [新增] 记录当前关卡号
        // --- [新增] 历史与记录 ---
        this.history = [];      // 快照栈
        this.stepCount = 0;     // 当前步数
        this.replayString = ""; // 录像字符串 (UDLR)
        this.MAX_HISTORY = 100; // 限制悔棋步数，防止内存无限膨胀
        // [新增] 永久保存"第0步"的状态，不受 history 长度限制
        this.initialSnapshot = null;
        // [新增] 回放专用状态
        this.isReplayMode = false;
        this.replayData = "";      // 这里的字符串 "UDRL..."
        this.replayIndex = 0;      // 当前播放到第几个字符
        this.replayTimer = null;   // 自动播放的计时器句柄
        this.replaySpeed = 200;    // 播放速度 (ms/step)
    }
    // --- [重构] 提取生成快照数据的逻辑 (私有辅助) ---
    _createSnapshotData() {
        return {
            fg: this.gridForeground.map(row => [...row]),
            bg: this.gridBackground.map(row => [...row]),
            player: { ...this.player },
            form: this.playerForm,
            color: this.colorTheme,
            invincible: this.isInvincible,
            status: this.gameStatus,
            steps: this.stepCount,
            replay: this.replayString
        };
    }
    createGrid() {
        return Array(this.gridSize).fill(0).map(() => Array(this.gridSize).fill(0));
    }

    // 将 Buffer 的更改应用到主网格 (arumonoset)
    syncBufferToMain() {
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                this.gridForeground[x][y] = this.gridBuffer[x][y];
            }
        }
    }

    // 将主网格复制到 Buffer (idougoset)
    syncMainToBuffer() {
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                this.gridBuffer[x][y] = this.gridForeground[x][y];
            }
        }
    }
    // --- [新增] 保存快照 (Deep Copy) ---
    saveSnapshot() {
        // 深拷贝二维数组 (性能足够快)
        const snapshot = {
            fg: this.gridForeground.map(row => [...row]),
            bg: this.gridBackground.map(row => [...row]),
            // Buffer 和 Texture 不需要存，因为它们是推导出来的

            player: { ...this.player }, // 浅拷贝对象
            form: this.playerForm,
            color: this.colorTheme,
            invincible: this.isInvincible,
            status: this.gameStatus,
            steps: this.stepCount,
            replay: this.replayString
        };

        this.history.push(snapshot);

        // 限制历史长度 (队列)
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift(); // 移除最旧的一步
        }
    }
    // --- [新增] 保存初始锚点 (只在关卡加载时调用一次) ---
    recordInitialState() {
        // 永久存一份，不做任何限制
        this.initialSnapshot = this._createSnapshotData();
        // 同时清空历史，确保干净
        this.history = [];
    }
    // --- [新增] 彻底重置 (Reset) ---
    resetGame() {
        if (!this.initialSnapshot) return;

        // 1. 读取初始锚点
        const snapshot = this.initialSnapshot;

        // 2. 恢复数据
        this.gridForeground = snapshot.fg.map(row => [...row]); // 必须再次深拷贝！防止后续修改污染锚点
        this.gridBackground = snapshot.bg.map(row => [...row]);
        this.syncMainToBuffer();

        this.player = { ...snapshot.player };
        this.playerForm = snapshot.form;
        this.colorTheme = snapshot.color;
        this.isInvincible = snapshot.invincible;
        this.gameStatus = snapshot.status;

        // 3. 强制重置统计数据
        this.stepCount = 0;
        this.replayString = "";
        this.effects = [];
        this.animTick = 0;

        // 4. 重置历史栈 (把初始状态作为新的第0步塞进去)
        // 这样重置后，按 Undo 不会报错，但也退无可退
        this.history = [this._createSnapshotData()];
    }
    // --- [新增] 恢复快照 (Undo) ---
    restoreSnapshot() {
        if (this.history.length === 0) return false;

        const snapshot = this.history.pop();

        // 恢复数据
        this.gridForeground = snapshot.fg;
        this.gridBackground = snapshot.bg;

        // 重要：恢复后，Buffer 必须立刻同步，否则逻辑会错乱
        this.syncMainToBuffer();

        this.player = snapshot.player;
        this.playerForm = snapshot.form;
        this.colorTheme = snapshot.color;
        this.isInvincible = snapshot.invincible;
        this.gameStatus = snapshot.status;
        this.stepCount = snapshot.steps;
        this.replayString = snapshot.replay;

        // 清空特效 (避免悔棋时看到之前的爆炸残留)
        this.effects = [];

        return true;
    }
}