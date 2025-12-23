class UIManager {
    constructor(game, saveSystem) {
        this.game = game;
        this.save = saveSystem;
        this.hbRow = 0;
        this.hbCol = 0;

        // 状态定义: 'TITLE', 'SELECT', 'GAME', 'PAUSE', 'IO', 'CREDITS'
        this.appState = 'TITLE';

        // 焦点索引
        this.focusIndex = 0;

        // 选关界面当前标签
        this.currentTab = 'OFFICIAL';
        
        // 当前正在玩的关卡类型 (用于决定退出时回到哪个标签)
        this.currentLevelType = 'OFFICIAL';

        // 缓存 DOM 元素
        this.dom = {
            title: document.getElementById('ui-title'),
            select: document.getElementById('ui-select'),
            hud: document.getElementById('ui-hud'),
            pause: document.getElementById('ui-pause'),
            io: document.getElementById('ui-io'),
            replayBar: document.getElementById('ui-replay-bar'),
            pauseBtn: document.getElementById('btn-replay-pause'),
            grid: document.getElementById('level-grid'),
            hudLvl: document.getElementById('hud-lvl'),
            hudSteps: document.getElementById('hud-steps'),
            credits: document.getElementById('ui-credits'),
            // 新增标签按钮
            tabOfficial: document.querySelector('.tab-btn:nth-child(1)'),
            tabCustom: document.querySelector('.tab-btn:nth-child(2)'),
            tabRandom: document.querySelector('.tab-btn:nth-child(3)')
        };

        // 缓存交互元素列表 (按钮数组)
        this.interactables = [];

        // 初始化数据
        this.officialList = this.generateOfficialManifest();
        this.customList = this.generateCustomManifest();
        this.randomList = this.generateRandomManifest();

        // 初始化事件监听
        this.setupTabListeners();

        // 初始化界面
        this.goToTitle();
    }
    // 4. 新增：鼠标点击处理
    // 鼠标处理 (在 HTML onclick="ui.handleHandbookClick(event)" 中调用)
// UIManager.js

handleHandbookClick(e) {
    if (this.appState !== 'HANDBOOK') return;

    const rect = e.currentTarget.getBoundingClientRect();
    
    // 物理坐标 -> Canvas逻辑坐标 (224x224)
    const x = (e.clientX - rect.left) * (224 / rect.width);
    const y = (e.clientY - rect.top) * (224 / rect.height);

    // 【调试代码】如果你点击没反应，F12看这里是否有输出
    console.log(`Handbook Click at X:${Math.round(x)} Y:${Math.round(y)}`);

    // 因为渲染放大了2倍，每个物理格子是 32px
    const col = Math.floor(x / 32);
    const row = Math.floor(y / 32);

    console.log(`Grid Map: Row ${row}, Col ${col}`);

    if (row >= 0 && row < 5 && col >= 0 && col < 7) {
        if (HB_LAYOUT[row] && HB_LAYOUT[row][col]) {
            this.hbRow = row;
            this.hbCol = col;
            this.updateHandbookInfo();
        }
    }
}
    // ==========================================
    // 输入路由 (由 Game.js 调用)
    // ==========================================
    handleInput(key) {
        // 统一键位映射
        const isUp = (key === 'ArrowUp' || key === 'w' || key === 'W');
        const isDown = (key === 'ArrowDown' || key === 's' || key === 'S');
        const isLeft = (key === 'ArrowLeft' || key === 'a' || key === 'A');
        const isRight = (key === 'ArrowRight' || key === 'd' || key === 'D');
        const isOk = (key === 'z' || key === 'Z' || key === 'Enter' || key === ' ');
        const isBack = (key === 'x' || key === 'X' || key === 'Escape' || key === 'Backspace');

        // 根据状态分发
        switch (this.appState) {
            case 'TITLE': this.navList(isUp, isDown, isOk, isBack); break;
            case 'PAUSE': this.navList(isUp, isDown, isOk, isBack); break;
            case 'IO': this.navIO(isUp, isDown, isOk, isBack); break; // 简单列表导航
            case 'SELECT': this.navGrid(isUp, isDown, isLeft, isRight, isOk, isBack); break;
            case 'HANDBOOK': this.navHandbook(isUp, isDown, isLeft, isRight, isBack); break;
            case 'CREDITS': this.navList(isUp, isDown, isOk, isBack); break;
            // 'GAME' 状态不由 UI 处理
        }
    }
    // 在 goToTitle 增加按钮跳转
    // goToHandbook 方法
    goToHandbook() {
        this.hideAll();
        document.getElementById('ui-handbook').classList.remove('hidden');
        this.appState = 'HANDBOOK';
        this.hbRow = 0;
        this.hbCol = 0;
        this.updateHandbookInfo();
    }

updateHandbookInfo() {
    const item = HB_LAYOUT[this.hbRow][this.hbCol];
    if (item) {
        document.getElementById('hb-name').textContent = item.n;
        document.getElementById('hb-desc').textContent = item.d;
    }
}
    // 键盘处理
    navHandbook(up, down, left, right, back) {
        if (back) { this.goToTitle(); return; }

        let or = this.hbRow, oc = this.hbCol;
        if (up) this.hbRow--; if (down) this.hbRow++;
        if (left) this.hbCol--; if (right) this.hbCol++;

        this.hbRow = (this.hbRow + 5) % 5;
        const rowLen = HB_LAYOUT[this.hbRow].length;
        this.hbCol = (this.hbCol + 7) % 7;

        // 跳过空位
        if (!HB_LAYOUT[this.hbRow][this.hbCol]) {
            // 如果点到空的，可以逻辑回退或寻找最近
        }

        if (or !== this.hbRow || oc !== this.hbCol) this.updateHandbookInfo();
    }
    // --- 列表导航通用逻辑 (标题、暂停菜单) ---
    // 只处理上下移动
    navList(up, down, ok, back) {
        if (up) this.moveFocus(-1);
        else if (down) this.moveFocus(1);
        else if (ok) this.triggerFocus();
        else if (back) {
            // 特殊回退逻辑
            if (this.appState === 'PAUSE') this.resumeGame(); // Esc关闭暂停
            else if (this.appState === 'IO') this.goToTitle();
        }
    }

    // --- 网格导航逻辑 (选关) ---
    // 处理上下左右
    navGrid(up, down, left, right, ok, back) {
        const COLS = 10; // 每行10个
        if (right) this.moveFocus(1);
        else if (left) this.moveFocus(-1);
        else if (down) this.moveFocus(COLS);
        else if (up) this.moveFocus(-COLS);
        else if (ok) this.triggerFocus();
        else if (back) this.goToTitle();
    }

    // --- 焦点移动核心 ---
    moveFocus(delta) {
        if (this.interactables.length === 0) return;

        // 移除旧高亮
        this.interactables[this.focusIndex].classList.remove('selected');

        // 计算新索引 (循环/边界处理视需求而定，这里做简单的边界限制)
        let newIndex = this.focusIndex + delta;

        // 列表循环逻辑 (比如标题界面到底了回顶)
        if (this.appState !== 'SELECT') {
            if (newIndex < 0) newIndex = this.interactables.length - 1;
            if (newIndex >= this.interactables.length) newIndex = 0;
        } else {
            // 网格逻辑 (不循环，卡在边界)
            if (newIndex < 0) newIndex = this.focusIndex; // 不动
            if (newIndex >= this.interactables.length) newIndex = this.focusIndex;
        }

        this.focusIndex = newIndex;

        // 添加新高亮
        const el = this.interactables[this.focusIndex];
        el.classList.add('selected');

        // 确保可视 (针对选关界面的滚动条)
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
    }

    // --- 触发点击 ---
    triggerFocus() {
        if (this.interactables[this.focusIndex]) {
            this.interactables[this.focusIndex].click();
        }
    }

    // ==========================================
    // 界面切换 & 焦点初始化
    // ==========================================

    // 辅助：收集当前界面的按钮
    setupFocus(containerId, defaultIndex = 0) {
        const container = document.getElementById(containerId);
        // 获取所有带 onclick 的元素，或者特定 class 的元素
        // 这里假设所有交互元素都有 .menu-btn 或 .lvl-card
        this.interactables = Array.from(container.querySelectorAll('.menu-btn, .lvl-card'));

        this.focusIndex = defaultIndex;
        if (this.interactables.length > 0) {
            // 清理可能的旧残留
            this.interactables.forEach(el => el.classList.remove('selected'));
            // 高亮默认
            this.interactables[this.focusIndex].classList.add('selected');
        }
    }
    // IO 菜单的键盘导航
    navIO(up, down, ok, back) {
        if (up) this.moveFocus(-1);
        else if (down) this.moveFocus(1);
        else if (ok) this.triggerFocus();
        else if (back) {
            this.goToTitle(); // 按 X/Esc 返回标题
        }
    }

    hideAll() {
        // 列出所有可能出现的 UI 层 ID
        const layers = ['title', 'select', 'hud', 'pause', 'io', 'credits', 'handbook', 'replay-bar'];
        layers.forEach(id => {
            const el = document.getElementById('ui-' + id);
            if (el) el.classList.add('hidden');
        });
    }
    // --- 页面跳转 ---

    goToTitle() {
        this.hideAll();
        if (this.dom.title) this.dom.title.classList.remove('hidden');

        this.appState = 'TITLE';
        this.game.gameStatus = -1; // 暂停

        // 初始化焦点: 默认选第一个 (Start Game)
        this.setupFocus('ui-title', 0);
        
        // 隐藏虚拟按键
        this.toggleVirtualControls(false);
    }

    goToLevelSelect(tab = 'OFFICIAL') {
        this.hideAll();
        
        // 切换到指定标签
        if (tab !== this.currentTab) {
            this.switchTab(tab);
        }
        
        this.renderGrid(); // 重绘网格
        if (this.dom.select) this.dom.select.classList.remove('hidden');

        this.appState = 'SELECT';
        this.game.gameStatus = -1;

        // 初始化焦点: 默认选第1关 (索引0)，或者上次玩的关卡(TODO)
        this.setupFocus('level-grid', 0);
        
        // 隐藏虚拟按键
        this.toggleVirtualControls(false);
    }

    togglePause() {
        // 只有在游戏中才能暂停
        if (this.appState !== 'GAME' && this.appState !== 'PAUSE') return;

        if (this.appState === 'GAME') {
            // 进入暂停
            this.dom.pause.classList.remove('hidden');
            this.appState = 'PAUSE';
            this.game.gameStatus = -1;
            // 焦点默认: Resume
            this.setupFocus('ui-pause', 0);
            
            // 隐藏虚拟按键
            this.toggleVirtualControls(false);
        } else {
            // 退出暂停
            this.resumeGame();
        }
    }

    resumeGame() {
        this.dom.pause.classList.add('hidden');
        this.dom.hud.classList.remove('hidden');

        this.appState = 'GAME';
        this.game.gameStatus = 0; // 恢复逻辑
        
        // 显示虚拟按键
        this.toggleVirtualControls(true);
    }
    
    // 控制虚拟按键的显示/隐藏
    toggleVirtualControls(show) {
        const virtualControls = document.getElementById('virtual-controls');
        if (virtualControls) {
            if (show) {
                virtualControls.classList.remove('hidden');
            } else {
                virtualControls.classList.add('hidden');
            }
        }
    }

    openIOMenu() {
        this.hideAll();
        if (this.dom.io) this.dom.io.classList.remove('hidden');
        this.appState = 'IO';
        this.setupFocus('ui-io', 0); // 默认选 Export
        
        // 隐藏虚拟按键
        this.toggleVirtualControls(false);
    }

    loadRandomLevel() {
        // 从生成的关卡中随机选择一个
        const levelKeys = Object.keys(GENERATED_LEVELS.levels);
        const randomKey = levelKeys[Math.floor(Math.random() * levelKeys.length)];
        const level = GENERATED_LEVELS.levels[randomKey];
        
        // 将随机key转换为3位8进制格式显示
        const octalNum = Number(randomKey).toString(8).padStart(3, '0');
        
        // 构建关卡配置
        const config = {
            label: octalNum,
            id: `gen_${randomKey}`,
            color: level.color || 0,
            levelData: level, // 直接传递关卡数据，避免ID冲突
            isRandom: true // 标记为随机关卡
        };
        
        this.startLevel(config);
    }

    startLevel(config) {
        this.hideAll();
        if (this.dom.hud) this.dom.hud.classList.remove('hidden');

        if (window.loadAndRunLevel) {
            window.loadAndRunLevel(config.id, config.color, config.levelData);

            // 关键：切换状态到 GAME，交出控制权
            this.appState = 'GAME';
            this.game.gameStatus = 0;

            if (this.dom.hudLvl) this.dom.hudLvl.textContent = config.label;
            this.updateSteps(0);
            
            // 显示虚拟按键
            this.toggleVirtualControls(true);
            
            // 设置当前关卡类型
            if (config.isRandom) {
                this.currentLevelType = 'RANDOM';
            } else if (config.id.startsWith('custom_')) {
                this.currentLevelType = 'CUSTOM';
            } else {
                this.currentLevelType = 'OFFICIAL';
            }
        }
    }

    // --- 数据生成 (保持不变) ---
    generateOfficialManifest() {
        const list = [];

        // 1. 正常主线 (1-52)
        for (let i = 1; i <= 52; i++) {
            const idStr = i.toString();
            let realColor = 0;

            // 【核心修复】
            // 不要写死 color: 0
            // 而是去全局变量 ALL_LEVELS 里查找这一关实际配置的颜色
            if (typeof ALL_LEVELS !== 'undefined' && ALL_LEVELS[idStr]) {
                realColor = ALL_LEVELS[idStr].color || 0;
            }

            list.push({
                label: idStr,
                id: idStr,
                color: realColor // <--- 传入查到的颜色
            });
        }
        // 2. 彩蛋关 (??)
        list.push({ label: "??", id: "53", color: 0, isSecret: true });

        // 3. 变色关卡组 (61-67) -> 显示为 53-87
        const baseIds = [61, 62, 63, 64, 65, 66, 67];
        const colors = [1, 2, 3, 4, 6];

        let labelIdx = 53;
        colors.forEach(col => {
            baseIds.forEach(bid => {
                list.push({
                    label: labelIdx.toString(),
                    id: bid.toString(),
                    color: col,
                    isVariant: true
                });
                labelIdx++;
            });
        });

        // 4. 高难变种 (81-93) -> 显示为 88-100
        for (let i = 81; i <= 93; i++) {
            list.push({ label: labelIdx.toString(), id: i.toString(), color: 0 });
            labelIdx++;
        }

        return list;
    }
    // 【新增】启动回放模式
    // --- [新增] 进入回放模式的 UI 切换 ---
    startReplayLevel(config, replayData) {
        this.hideAll();

        // 显示 HUD 和 回放条
        if (this.dom.hud) this.dom.hud.classList.remove('hidden');
        if (this.dom.replayBar) this.dom.replayBar.classList.remove('hidden');

        // 调用 Game.js 的全局接口
        if (window.startReplay) {
            window.startReplay(config.id, config.color, replayData, config.levelData);

            // 更新 HUD 标题
            if (this.dom.hudLvl) this.dom.hudLvl.textContent = `${config.label} (Replay)`;
            this.updateSteps(0);
        }
    }
    // 设置标签切换的事件监听
    setupTabListeners() {
        if (this.dom.tabOfficial) {
            this.dom.tabOfficial.addEventListener('click', () => {
                this.switchTab('OFFICIAL');
            });
        }
        if (this.dom.tabCustom) {
            this.dom.tabCustom.addEventListener('click', () => {
                this.switchTab('CUSTOM');
            });
        }
        if (this.dom.tabRandom) {
            this.dom.tabRandom.addEventListener('click', () => {
                this.switchTab('RANDOM');
            });
        }
    }

    // 切换选关标签
    switchTab(tabName) {
        if (this.currentTab === tabName) return;

        this.currentTab = tabName;

        // 更新标签按钮样式
        if (this.dom.tabOfficial) {
            this.dom.tabOfficial.classList.toggle('active', tabName === 'OFFICIAL');
        }
        if (this.dom.tabCustom) {
            this.dom.tabCustom.classList.toggle('active', tabName === 'CUSTOM');
        }
        if (this.dom.tabRandom) {
            this.dom.tabRandom.classList.toggle('active', tabName === 'RANDOM');
        }

        // 重新渲染网格
        this.renderGrid();
    }

    // 生成自定义关卡列表
    generateCustomManifest() {
        const list = [];
        
        // 检查是否存在自定义关卡
        if (typeof CUSTOM_LEVELS !== 'undefined' && CUSTOM_LEVELS.levels) {
            const levels = CUSTOM_LEVELS.levels;
            const keys = Object.keys(levels);
            
            keys.forEach(key => {
                const level = levels[key];
                list.push({
                    label: key,
                    id: `custom_${key}`,
                    color: level.color || 0,
                    levelData: level // 直接存储关卡数据
                });
            });
        }
        
        return list;
    }
    
    // 生成随机关卡列表
    generateRandomManifest() {
        const list = [];
        
        // 检查是否存在随机关卡
        if (typeof GENERATED_LEVELS !== 'undefined' && GENERATED_LEVELS.levels) {
            const levels = GENERATED_LEVELS.levels;
            const keys = Object.keys(levels);
            
            keys.forEach(key => {
                const level = levels[key];
                // 将key转换为3位8进制格式显示
                const octalNum = Number(key).toString(8).padStart(3, '0');
                list.push({
                    label: octalNum,
                    id: `gen_${key}`,
                    color: level.color || 0,
                    levelData: level, // 直接存储关卡数据
                    isRandom: true
                });
            });
        }
        
        return list;
    }

    renderGrid() {
        if (!this.dom.grid) return;

        this.dom.grid.innerHTML = ''; // 清空旧按钮

        // 根据当前标签选择关卡列表
        let currentList;
        switch(this.currentTab) {
            case 'OFFICIAL':
                currentList = this.officialList;
                break;
            case 'CUSTOM':
                currentList = this.customList;
                break;
            case 'RANDOM':
                currentList = this.randomList;
                break;
            default:
                currentList = this.officialList;
        }

        currentList.forEach(item => {
            const btn = document.createElement('div');
            btn.className = 'lvl-card';

            // 构造存档 Key，与 Game.js 中的 currentLevelKey 构造方式保持一致
            let saveKey;
            if (item.color > 0) {
                saveKey = `${item.id}_c${item.color}`;
            } else {
                saveKey = item.id;
            }

            // 读取存档状态
            const record = this.save.getLevelInfo(saveKey);
            if (record && record.cleared) {
                btn.classList.add('cleared'); // 添加通关样式
            }

            // HTML 内容
            let html = `<div class="lvl-num">${item.label}</div>`;

            if (item.color !== 0) {
                const colorHex = this.getColorHex(item.color);
                html += `<div class="color-dot" style="background:${colorHex}"></div>`;
            }
            if (record) {
                html += `<div class="best-step">${record.bestSteps}</div>`;
            }

            btn.innerHTML = html;

            btn.onclick = () => {
                this.startLevel(item);
            };
            // 如果有录像，添加播放小按钮
            if (record && record.replay && record.replay.length > 0) {
                const playBtn = document.createElement('div');
                playBtn.className = 'play-replay-btn';
                playBtn.innerHTML = '▶';
                playBtn.title = 'Watch Replay';

                // 点击播放按钮
                playBtn.onclick = (e) => {
                    e.stopPropagation(); // 关键！阻止触发 btn.onclick (正常开始游戏)
                    this.startReplayLevel(item, record.replay);
                };

                btn.appendChild(playBtn);
            }
            this.dom.grid.appendChild(btn);
        });
    }
    goToCredits() {
        this.hideAll();
        if (this.dom.credits) this.dom.credits.classList.remove('hidden');
        this.appState = 'CREDITS';
        this.setupFocus('ui-credits', 0); // 焦点给 Back 按钮
        
        // 隐藏虚拟按键
        this.toggleVirtualControls(false);
    }

    updateSteps(s) { if (this.dom.hudSteps) this.dom.hudSteps.textContent = s; }
    getColorHex(c) {
        switch (c) {
            case 1: return '#44f'; case 2: return '#f44'; case 3: return '#4f4';
            case 4: return '#ee4'; case 6: return '#d4d'; default: return '#fff';
        }
    }
}




