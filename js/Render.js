class Renderer {
    constructor(gameState, canvasId) {
        this.state = gameState;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.images = {};

        // 调试标记
        this.isReady = false;

        const imageKeys = Object.keys(IMAGES);
        const total = imageKeys.length;
        let loadedCount = 0;
        let errorCount = 0;

        console.log(`[Render] 开始加载 ${total} 张图片...`);

        imageKeys.forEach(key => {
            const src = IMAGES[key];
            const img = new Image();

            img.onload = () => {
                loadedCount++;
                // console.log(`[Render] Loaded: ${src}`);
                if (loadedCount + errorCount === total) {
                    this.finishLoading();
                }
            };

            img.onerror = () => {
                errorCount++;
                console.error(`[Render] ❌ 图片加载失败: ${src} (Key: ${key})`);
                // 即使失败也继续，防止卡死，虽然画面会缺东西
                if (loadedCount + errorCount === total) {
                    this.finishLoading();
                }
            };

            img.src = src;
            // 建立映射：既可以通过 key (IMAGES.MAIN) 访问，也可以通过 src 字符串访问
            this.images[key] = img;
            this.images[src] = img;
        });
    }

    finishLoading() {
        console.log("[Render] 资源加载队列结束。启动渲染。");
        this.isReady = true;
        this.draw();
    }

    draw() {
        if (!this.isReady) return;
        // 清除画布


        if (ui && ui.appState === 'HANDBOOK') {
            this.ctx.clearRect(0, 0, 224, 224);
            this.drawHandbook();
            return; // 彻底隔离，不执行下方游戏逻辑
        }
        // 1. 画全屏背景 (Yuka)
        const color = this.state.colorTheme;
        const bgKey = (color === 0) ? 'assets/yuka.png' : `assets/yuka${color}.png`;
        const bgImg = this.images[bgKey] || this.images['assets/yuka.png'];
        if (bgImg) this.ctx.drawImage(bgImg, 0, 0);
        else {
            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(0, 0, 224, 224);
        }

        // 更新 Tick
        this.state.animTick = (this.state.animTick + 1) % 60;
        const tick = this.state.animTick;

        // 2. 遍历网格
        for (let x = 0; x < 14; x++) {
            for (let y = 0; y < 14; y++) {
                const drawX = x * 16;
                const drawY = (13 - y) * 16;

                // --- A. 背景层 (Triggers) ---
                const bgId = this.state.gridBackground[x][y];
                if (bgId === 2 || bgId === 3) {
                    const conf = SPRITE_CONFIG.TRIGGERS.getSprite(bgId, this.state.colorTheme);
                    if (conf) this.drawSprite(conf, drawX, drawY);
                }
                else if (bgId >= 11 && bgId <= 16) {
                    const conf = SPRITE_CONFIG.COLOR_TRIGGERS.getSprite(bgId);
                    if (conf) this.drawSprite(conf, drawX, drawY);
                }

                // --- B. 前景层 (Foreground) ---
                const id = this.state.gridForeground[x][y];
                if (id === 0) continue;
                // Render.js -> draw() 内部循环

                // --- 1. 墙壁与障碍物 (ID 2 普通墙 / ID 7 栅栏 / ID 8 特殊墙) ---
                if (id === 2 || id === 7 || id === 8) {
                    const moyou = this.state.gridTexture[x][y];

                    // 第一层：画主体 (Body)
                    // getBody 内部已经处理了 moyou 26 的特殊贴图切换
                    if (SPRITE_CONFIG.WALLS.getBody) {
                        const bodyConf = SPRITE_CONFIG.WALLS.getBody(
                            this.state.colorTheme,
                            moyou,
                            x, y
                        );
                        this.drawSprite(bodyConf, drawX, drawY);
                    }

                    // 第二层：画线框 (Overlay)
                    // moyou 26 在 RenderConfig 里会返回 null，所以这里安全
                    if (moyou > 0 && SPRITE_CONFIG.WALLS.getOverlay) {
                        const overlayConf = SPRITE_CONFIG.WALLS.getOverlay(
                            this.state.colorTheme,
                            moyou
                        );
                        this.drawSprite(overlayConf, drawX, drawY);
                    }

                    // 第三层：ID 8 特殊叠加 (保持不变)
                    if (id === 8) {
                        const bgId = this.state.gridBackground[x][y];
                        if (bgId > 0 && bgId < 200) {
                            const decalConf = SPRITE_CONFIG.HEARTS.getSprite(bgId, tick);
                            if (decalConf) this.drawSprite(decalConf, drawX, drawY);
                        }
                    }
                }

                // --- 2. 锁与开关 (ID 400+) ---
                // 这里我们保留一个简单的逻辑：直接用 Body 逻辑画成实心方块
                else if (id >= 400) {
                    // 锁通常也是固定的方块，我们强制让它用 moyou 26 的画法
                    // 但颜色可能需要根据 ID 偏移
                    let lockColor = this.state.colorTheme;
                    if (id >= 401 && id <= 405) lockColor = id - 400;
                    else if (id === 416 || id === 419) lockColor = 6;

                    // 借用 getBody 但强制传入 26 以获得那个特殊的方块贴图
                    const lockConf = SPRITE_CONFIG.WALLS.getBody(lockColor, 26, x, y);
                    this.drawSprite(lockConf, drawX, drawY);
                }
                // 2. 主角 (活)
                else if (id === 1) {
                    // 【关键】如果死透了(Status 2)，这里不画，交给后面的尸体逻辑画
                    if (this.state.gameStatus !== 2) {
                        const conf = SPRITE_CONFIG.HEROINE.getSprite(
                            this.state.playerForm, this.state.player.dir, tick
                        );
                        this.drawSprite(conf, drawX, drawY);
                    }
                }
                // 3. 怪物 (e系列 & g系列)
                else if (id >= 11 && id <= 26) {
                    // 逻辑：ID 16(变色龙) 和 21-26(魔像) 用 COLOR 表
                    // ID 11-15(普通) 用 SIMPLE 表
                    if (id === 16 || (id >= 21 && id <= 26)) {
                        const conf = SPRITE_CONFIG.ENEMIES.COLOR.getSprite(id, this.state.colorTheme, tick);
                        this.drawSprite(conf, drawX, drawY);
                    }
                    else if (id===18){
                        const conf = SPRITE_CONFIG.ENEMIES.COLOR.getSprite(25,this.state.colorTheme, tick);
                        this.drawSprite(conf, drawX, drawY);
                    }
                    else if (id===17){
                        const conf = SPRITE_CONFIG.ENEMIES.COLOR.getSprite(16,this.state.colorTheme, tick);
                        this.drawSprite(conf, drawX, drawY);
                    }
                    else if (this.state.colorTheme !== 0) {
                        const conf = SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(id, tick);
                        this.drawSprite(conf, drawX, drawY);
                    }
                    else {
                        const conf = SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(id, tick);
                        this.drawSprite(conf, drawX, drawY);
                    }
                }
                // 4. 血条 (100-131)
                else if (id >= 100 && id <= 131) {
                    const conf = SPRITE_CONFIG.HEARTS.getSprite(id, tick);
                    if (conf) this.drawSprite(conf, drawX, drawY);
                }
                // 5. 箱子/石头 (400+)
                // else if (id >= 400) {
                //     const conf = SPRITE_CONFIG.BOXES.getSprite(this.state.colorTheme);
                //     this.drawSprite(conf, drawX, drawY);
                // }
            }
        }

        // 3. 画主角尸体 (覆盖层)
        // 只有当游戏输了，且主角 ID 已经被逻辑清除时才需要补画？
        // 或者强制补画在最后位置
        if (this.state.gameStatus === 2) {
            const px = this.state.player.x;
            const py = this.state.player.y;
            const corpseConf = SPRITE_CONFIG.DEAD_BODY.getSprite(
                1,
                this.state.playerForm,
                this.state.player.dir,
                false // 主角死通常不是被压死(isCrushed=false)
            );
            if (corpseConf) this.drawSprite(corpseConf, px * 16, (13 - py) * 16);
        }

        // 4. 画特效 (爆炸+怪物尸体)
        for (let i = this.state.effects.length - 1; i >= 0; i--) {
            const fx = this.state.effects[i];
            const elapsed = Date.now() - fx.startTime;

            const FRAME_DURATION = 100;
            const ANIM_LEN = 2;
            const frameIdx = Math.floor(elapsed / FRAME_DURATION);

            const drawX = fx.x * 16;
            const drawY = (13 - fx.y) * 16;

            if (frameIdx < ANIM_LEN) {
                // A. 画尸体 (垫底)
                if (fx.type === 'DIE') {
                    const corpseConf = SPRITE_CONFIG.DEAD_BODY.getSprite(
                        fx.id || 11,
                        fx.form || 1,
                        0,
                        fx.isCrushed,
                        fx.color || 0
                    );
                    if (corpseConf) this.drawSprite(corpseConf, drawX, drawY);
                }

                // B. 画爆炸
                if (SPRITE_CONFIG.EXPLOSION && SPRITE_CONFIG.EXPLOSION.getSprite) {
                    const animConf = SPRITE_CONFIG.EXPLOSION.getSprite(
                        fx.form,
                        fx.isCrushed,
                        frameIdx
                    );
                    if (animConf) this.drawSprite(animConf, drawX, drawY);
                }

            } else {
                this.state.effects.splice(i, 1);
            }
        }
    }
// Renderer.js 中的 drawHandbook
drawHandbook() {
    // 1. 彻底禁用平滑处理
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.msImageSmoothingEnabled = false;

    const tick = this.state.animTick;
    this.state.animTick = (this.state.animTick + 1) % 60;

    // 绘制背景 (如果是 yuka.png，它也是 224x224)
    const bgImg = this.images['assets/yuka.png'];
    if (bgImg) this.ctx.drawImage(bgImg, 0, 0);

    this.ctx.save();
    // 2. 放大 2 倍
    this.ctx.scale(2, 2); 

    HB_LAYOUT.forEach((row, rIdx) => {
        row.forEach((item, cIdx) => {
            if (!item) return;

            // 3. 紧密排列：逻辑网格是 16x16，放大后就是 32x32
            // 7列 * 16px(logic) = 112px(logic) -> 2倍后 224px (物理)
            // 5行 * 16px(logic) = 80px(logic) -> 2倍后 160px (物理)
            const x = cIdx * 16; 
            const y = rIdx * 16;

            let conf = null;
            // 获取配置逻辑 (保持不变)
            if (item.id === 1) conf = SPRITE_CONFIG.HEROINE.getSprite(item.f, 3, tick);
            else if (item.id >= 100 && item.id <= 131) conf = SPRITE_CONFIG.HEARTS.getSprite(item.id, tick);
            else if (item.id >= 11 && item.id <= 26 && !item.t) {
                let mc = (item.id === 21)?1:(item.id === 22)?2:(item.id === 23)?3:(item.id === 24)?4:(item.id === 25)?6:0;
                conf = (item.id === 16 || (item.id >= 21)) ? 
                       SPRITE_CONFIG.ENEMIES.COLOR.getSprite(item.id, mc, tick) : 
                       SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(item.id, tick);
            } else if (item.t === 'f') conf = SPRITE_CONFIG.COLOR_TRIGGERS.getSprite(item.id);
            else if (item.t === 't') conf = SPRITE_CONFIG.TRIGGERS.getSprite(item.id, 0);

            if (conf) {
                // 直接绘制在网格起始点，不偏移，实现“密铺”
                this.drawSprite(conf, x, y);
            }

            // 4. 绘制选中框 (Logic 坐标)
            if (ui.hbRow === rIdx && ui.hbCol === cIdx) {
                this.ctx.strokeStyle = '#0f0';
                this.ctx.lineWidth = 1;
                // 绘制逻辑尺寸为 16x16 的边框
                this.ctx.strokeRect(x, y, 16, 16);
            }
        });
    });

    this.ctx.restore();
}
    // Render.js 底部

    drawSprite(conf, x, y) {
        if (!conf || !this.images[conf.img]) return;

        // // 如果配置要求水平翻转 (flipH)
        // if (conf.flipH) {
        //     this.ctx.save(); // 保存当前状态

        //     // 1. 将原点移动到目标格子的中心
        //     // 假设格子大小是 16 (TILE_SIZE)
        //     this.ctx.translate(x + 8, y + 8);

        //     // 2. 执行水平镜像
        //     this.ctx.scale(-1, 1);

        //     // 3. 绘制图片 (坐标变为相对中心的 -8, -8)
        //     this.ctx.drawImage(
        //         this.images[conf.img],
        //         conf.x, conf.y, 16, 16,
        //         -8, -8, 16, 16
        //     );

        //     this.ctx.restore(); // 恢复状态
        // } else 
        {
            // 正常绘制
            this.ctx.drawImage(
                this.images[conf.img],
                conf.x, conf.y, 16, 16,
                x, y, 16, 16
            );
        }
    }
}