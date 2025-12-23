// Game.js

// 1. 初始化核心模块
const gameState = new GameState();
const saveSystem = new SaveSystem(); // 存档系统

const visualLogic = new VisualLogic(gameState);
const battleLogic = new BattleLogic(gameState);
const moveLogic = new MovementLogic(gameState, battleLogic);
const levelLoader = new LevelLoader(gameState);
const renderer = new Renderer(gameState, 'gameCanvas');

// [新增] UI 管理器变量
let ui;

// 2. 页面加载完成后初始化 UI
window.onload = function () {
    // 实例化 UI，把 state 和 save 传给它
    ui = new UIManager(gameState, saveSystem);

    // 为虚拟按键添加事件监听器
    setupVirtualButtons();

    // 启动渲染循环 (此时处于主菜单，画面可能被 UI 遮挡，但保持渲染没问题)
    requestAnimationFrame(gameLoop);
};

// 设置虚拟按键事件监听器
function setupVirtualButtons() {
    // 为方向键添加事件监听
    document.querySelectorAll('.btn-dir').forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = btn.dataset.key;
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
        
        // 同时支持鼠标点击
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const key = btn.dataset.key;
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
    });

    // 为退出键添加事件监听
    const exitBtn = document.querySelector('.btn-exit');
    if (exitBtn) {
        exitBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = exitBtn.dataset.key;
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
        
        // 同时支持鼠标点击
        exitBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const key = exitBtn.dataset.key;
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
    }
    
    // 为回退键(Z)添加事件监听
    const undoBtn = document.querySelector('.btn-undo');
    if (undoBtn) {
        undoBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = 'z'; // 直接使用 'z' 而不是 dataset.key
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
        
        // 同时支持鼠标点击
        undoBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const key = 'z'; // 直接使用 'z' 而不是 dataset.key
            const event = new KeyboardEvent('keydown', { key });
            window.dispatchEvent(event);
        });
    }
}
// --- [新增] 强制清理回放状态 ---
window.clearReplayState = function() {
    // 1. 停止计时器 (最关键！)
    if (gameState.replayTimer) {
        clearInterval(gameState.replayTimer);
        gameState.replayTimer = null;
    }

    // 2. 重置标志位
    gameState.isReplayMode = false;
    gameState.replayIndex = 0;
    gameState.replayData = "";

    console.log("[System] Replay state cleared.");
};
// 更新网页图标
function updateFavicon(form) {
    let favicon = document.getElementById('page-favicon');
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.id = 'page-favicon';
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    // 根据形态设置不同的图标
    // 形态1：银发（艾拉），使用ella.png
    // 形态2：粉发（雪莉），使用shirley.png
    favicon.href = form === 1 ? 'assets/ella.png' : 'assets/shirley.png';
    favicon.sizes = '16x16';
}

// 暴露updateFavicon为全局函数，供MovementLogic使用
window.updateFavicon = updateFavicon;

// 3. [新增] 供 UIManager 调用的全局接口
// 用于开始/加载关卡
window.loadAndRunLevel = function (levelId, colorOverride, levelData) {
     window.clearReplayState();
    // 加载数据
    if (levelData) {
        levelLoader.loadCustomLevel(levelData);
    } else {
        levelLoader.loadLevel(levelId);
    }

    // 处理变色关卡逻辑 (61-67)
    if (colorOverride > 0) {
        gameState.colorTheme = colorOverride;
        // 记录特殊的存档 Key (例如 61_c1)
        gameState.currentLevelKey = `${levelId}_c${colorOverride}`;
    } else {
        gameState.currentLevelKey = levelId;
    }

    // 初始计算纹理 & 保存开局快照
    visualLogic.updateAutoTiling();
    // 这会自动清空 history 并保存一份永久的"第0步"
    gameState.recordInitialState();

    // 更新网页图标为当前形态
    updateFavicon(gameState.playerForm);
    console.log(`Game started: Level ${levelId}, Color: ${gameState.colorTheme}`);
};

// 用于重置当前关卡 (R键或菜单重试)
window.resetCurrentLevel = function () {
    // [修改] 使用新的重置方法
    gameState.resetGame();

    // 更新视觉
    visualLogic.updateAutoTiling();
    if (ui) ui.updateSteps(0);
    // 更新网页图标为当前形态
    updateFavicon(gameState.playerForm);

    console.log("Level Reset to Initial State.");
};

// 4. 渲染循环
function gameLoop() {
    renderer.draw();
    requestAnimationFrame(gameLoop);
}

// 5. 输入监听
// Game.js 输入监听部分

window.addEventListener('keydown', (e) => {
    // 1. 获取按键类型
    const key = e.key;

    // 2. 路由分发
    // 如果不是游戏状态，全部交给 UI 托管
    if (ui.appState !== 'GAME') {
        // 防止按方向键滚动网页
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(key)) {
            e.preventDefault();
        }
        
        ui.handleInput(key);
        return; // 【关键】直接结束，不执行下面的游戏逻辑
    }

    // --- 以下是游戏状态 (GAME) 下的逻辑 ---
    
    // ESC 暂停
    if (key === 'Escape') {
        ui.togglePause();
        return;
    }

    // 悔棋 (Z)
    if (key === 'z' || key === 'Z' || key === 'Backspace') {
        if (gameState.restoreSnapshot()) {
            visualLogic.updateAutoTiling();
            ui.updateSteps(gameState.stepCount); 
            // 更新网页图标为当前形态
            updateFavicon(gameState.playerForm);
            console.log("Undo performed.");
        }
        return;
    }
    
    // 重置 (R)
    if (key === 'r' || key === 'R') {
        window.resetCurrentLevel();
        ui.updateSteps(gameState.stepCount);
        return;
    }

    // 移动
    let dx = 0, dy = 0;
    if (key === 'ArrowUp' || key === 'w' || key === 'W') dy = 1;
    else if (key === 'ArrowDown' || key === 's' || key === 'S') dy = -1;
    else if (key === 'ArrowLeft' || key === 'a' || key === 'A') dx = -1;
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') dx = 1;
    else return;
    
    e.preventDefault(); 
    
    if (gameState.gameStatus !== 0) return;

    moveLogic.processMoveInput(dx, dy);
    visualLogic.updateAutoTiling();
    ui.updateSteps(gameState.stepCount);

    if (gameState.gameStatus === 1) {
        setTimeout(() => {
            // 保存通关记录
            if (saveSystem && gameState.currentLevelKey) {
                saveSystem.submitResult(
                    gameState.currentLevelKey,
                    gameState.stepCount,
                    gameState.replayString
                );
            }
            alert(`STAGE CLEAR!\nSteps: ${gameState.stepCount}`);
            // 退出到对应选关界面
            ui.goToLevelSelect(ui.currentLevelType);
        }, 100);
    }
});

// 进入回放模式 (由 UI 调用)
// Game.js

window.startReplay = function(levelId, colorOverride, replayStr, levelData) {
    // 1. 加载关卡 
    // (这会自动调用 clearReplayState，把 isReplayMode 设为 false)
    window.loadAndRunLevel(levelId, colorOverride, levelData);
    
    // 2. [关键] 重新开启回放模式
    gameState.isReplayMode = true;
    gameState.replayData = replayStr;
    gameState.replayIndex = 0;
    
    // 3. 启动计时器
    window.toggleReplayPause(false); 
    
    console.log("Replay started sequence.");
};

// 切换 播放/暂停
window.toggleReplayPause = function (forcePause) {
    if (gameState.replayTimer || forcePause) {
        clearInterval(gameState.replayTimer);
        gameState.replayTimer = null;
    } else {
        gameState.replayTimer = setInterval(window.stepReplay, gameState.replaySpeed);
    }
};

// 单步执行
window.stepReplay = function () {
    if (!gameState.isReplayMode) return;

    // 检查是否播放完毕
    if (gameState.replayIndex >= gameState.replayData.length) {
        window.toggleReplayPause(true); // 暂停
        alert("Replay Finished");
        return;
    }

    // 读取当前指令
    const char = gameState.replayData[gameState.replayIndex];
    let dx = 0, dy = 0;

    if (char === 'U') dy = 1;
    else if (char === 'D') dy = -1;
    else if (char === 'L') dx = -1;
    else if (char === 'R') dx = 1;

    // 执行移动 (注意：这里不需要再存入 replayString 了，MovementLogic 里需要判断 isReplayMode)
    // 但为了简单，MovementLogic 继续存也没事，只是覆盖了而已。
    // 关键是：回放时也要存 Snapshot，以便支持"回放中的单步后退"。

    moveLogic.processMoveInput(dx, dy);

    // 更新视图
    visualLogic.updateAutoTiling();

    // 指针后移
    gameState.replayIndex++;

    // 更新 UI (比如高亮当前按键，或者进度条)
    // ui.updateReplayProgress(...) 
};

// 单步后退 (利用 Snapshot)
window.stepBackReplay = function () {
    window.toggleReplayPause(true); // 后退前强制暂停

    if (gameState.replayIndex > 0) {
        if (gameState.restoreSnapshot()) {
            visualLogic.updateAutoTiling();
            gameState.replayIndex--; // 指针回退
        }
    }
};

// 退出回放
window.exitReplay = function () {
     window.clearReplayState();
    window.toggleReplayPause(true);
    gameState.isReplayMode = false;
    ui.goToLevelSelect();
};


// --- [新增] 墙壁调试器 ---
// 开启后，鼠标悬停显示 Moyou ID
const DEBUG_MOYOU = true;

if (DEBUG_MOYOU) {
    const canvas = document.getElementById('gameCanvas');

    // 创建一个悬浮的 Debug Tip
    const debugTip = document.createElement('div');
    debugTip.style.position = 'absolute';
    debugTip.style.background = 'rgba(0,0,0,0.8)';
    debugTip.style.color = '#0f0';
    debugTip.style.padding = '5px';
    debugTip.style.pointerEvents = 'none';
    debugTip.style.zIndex = '999';
    debugTip.style.fontSize = '12px';
    debugTip.style.display = 'none';
    document.body.appendChild(debugTip);

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        // 计算鼠标在 Canvas 内的相对位置
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 转换为逻辑网格 (16px per grid)
        const gridX = Math.floor(x / 16);
        // Canvas Y=0 is Top, but logic Y=0 is Bottom (13-y)
        const gridY = 13 - Math.floor(y / 16);

        if (gridX >= 0 && gridX < 14 && gridY >= 0 && gridY < 14) {
            const id = gameState.gridForeground[gridX][gridY];
            const moyou = gameState.gridTexture[gridX][gridY];

            debugTip.style.display = 'block';
            debugTip.style.left = (e.clientX + 10) + 'px';
            debugTip.style.top = (e.clientY + 10) + 'px';
            debugTip.innerHTML = `
                X: ${gridX}, Y: ${gridY}<br>
                ID: ${id}<br>
                Moyou: <b>${moyou}</b>
            `;
        } else {
            debugTip.style.display = 'none';
        }
    });
    

    canvas.addEventListener('mouseout', () => {
        debugTip.style.display = 'none';
    });
    // --- Game.js 结尾处添加 ---

document.getElementById('gameCanvas').addEventListener('mousedown', (e) => {
    if (ui.appState !== 'HANDBOOK') return;

    const rect = e.target.getBoundingClientRect();
    const scaleX = e.target.width / rect.width;
    const scaleY = e.target.height / rect.height;

    // 计算 Canvas 坐标
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    // 调用 UI 处理逻辑
    ui.handleHandbookMouse(canvasX, canvasY);
});
}