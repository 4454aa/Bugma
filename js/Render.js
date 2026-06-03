class Renderer {
    constructor(gameState, canvasId) {
        this.state = gameState;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.images = {};
        this.isReady = false;
        this.lastFrameTime = performance.now();
        this.torchAnimTime = 0;
        this.lightCanvas = document.createElement('canvas');
        this.lightCtx = this.lightCanvas.getContext('2d');

        // sun.cs pulse state
        this.sunKosa = 3;
        this.sunJitterX = 0;
        this.sunJitterY = 0;
        this.sunWarizan = 0.5;
        this.sunAlpha = 0;

        const imageKeys = Object.keys(IMAGES);
        const total = imageKeys.length;
        let loadedCount = 0;
        let errorCount = 0;

        imageKeys.forEach(key => {
            const src = IMAGES[key];
            const img = new Image();

            img.onload = () => {
                loadedCount++;
                if (loadedCount + errorCount === total) this.finishLoading();
            };

            img.onerror = () => {
                errorCount++;
                console.error(`[Render] Failed to load image: ${src} (${key})`);
                if (loadedCount + errorCount === total) this.finishLoading();
            };

            img.src = src;
            this.images[key] = img;
            this.images[src] = img;
        });
    }

    finishLoading() {
        this.isReady = true;
        this.draw();
    }

    syncCanvasSize(width, height) {
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;

        const container = this.canvas.parentElement;
        if (container) {
            const ratio = width / height;
            const maxPixelWidth = Math.min(672, width * 3);
            container.style.aspectRatio = `${width} / ${height}`;
            container.style.width = `min(${maxPixelWidth}px, 94vw, calc(94vh * ${ratio}))`;
        }
    }

    draw() {
        if (!this.isReady) return;

        const now = performance.now();
        const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
        this.lastFrameTime = now;

        if (typeof ui !== 'undefined' && ui && ui.appState === 'HANDBOOK') {
            this.syncCanvasSize(224, 224);
            this.ctx.clearRect(0, 0, 224, 224);
            this.drawHandbook();
            return;
        }

        if (this.isMenuCanvasState()) {
            this.syncCanvasSize(224, 224);
            this.setPixelMode();
            this.ctx.clearRect(0, 0, 224, 224);
            this.drawBackground();
            return;
        }

        this.syncCanvasSize(this.state.canvasWidth(), this.state.canvasHeight());
        this.setPixelMode();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();

        this.state.animTick = (this.state.animTick + 1) % 60;
        const tick = this.state.animTick;

        this.torchAnimTime = (this.torchAnimTime + dt) % 60;
        this.drawBoard(tick);
        this.updateLight(dt);
        this.drawLighting(tick);
        this.drawTorches(tick);
        this.drawCorpse();
        this.drawEffects();
    }

    isMenuCanvasState() {
        if (typeof ui === 'undefined' || !ui) return false;
        return ['TITLE', 'SELECT', 'IO', 'CREDITS'].includes(ui.appState);
    }

    setPixelMode() {
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.mozImageSmoothingEnabled = false;
        this.ctx.webkitImageSmoothingEnabled = false;
        this.ctx.msImageSmoothingEnabled = false;
    }

    drawBackground() {
        const color = this.state.colorTheme;
        const bgKey = color === 0 ? 'assets/yuka.png' : `assets/yuka${color}.png`;
        const bgImg = this.images[bgKey] || this.images['assets/yuka.png'];

        if (!bgImg) {
            this.ctx.fillStyle = '#222';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        for (let y = 0; y < this.canvas.height; y += bgImg.height) {
            for (let x = 0; x < this.canvas.width; x += bgImg.width) {
                this.ctx.drawImage(bgImg, x, y);
            }
        }
    }

    drawBoard(tick) {
        this.state.forEachCell((x, y) => {
            const drawX = this.state.drawX(x);
            const drawY = this.state.drawY(y);
            const bgId = this.state.gridBackground[x][y];

            this.drawBackgroundTile(bgId, drawX, drawY);
        });

        this.drawObjectShadows();

        this.state.forEachCell((x, y) => {
            const drawX = this.state.drawX(x);
            const drawY = this.state.drawY(y);
            this.drawForegroundTile(x, y, drawX, drawY, tick);
        });
    }

    drawObjectShadows() {
        const playerCenter = this.getPlayerLightCenter();

        this.state.forEachCell((x, y) => {
            const id = this.state.gridForeground[x][y];
            const alpha = this.getObjectShadowAlpha(id);
            if (alpha <= 0) return;

            const cx = this.state.drawX(x) + TILE_SIZE / 2;
            const cy = this.state.drawY(y) + TILE_SIZE / 2;
            const dx = cx - playerCenter.x;
            const dy = cy - playerCenter.y;
            const len = Math.hypot(dx, dy) || 1;
            const offsetX = (dx / len) * 3;
            const offsetY = (dy / len) * 3;

            this.ctx.save();
            this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            this.ctx.translate(this.state.drawX(x) + offsetX, this.state.drawY(y) + offsetY);
            this.ctx.transform(1, 0, -0.18 * Math.sign(dx || 1), 0.42, 0, TILE_SIZE * 0.72);
            this.ctx.fillRect(3, 2, TILE_SIZE - 6, TILE_SIZE - 4);
            this.ctx.restore();
        });
    }

    getObjectShadowAlpha(id) {
        if (id >= 11 && id <= 26) return 0.22;
        if (id >= 400) return 0.26;
        if (id === 9) return 0.2;
        return 0;
    }

    drawBackgroundTile(bgId, drawX, drawY) {
        if (bgId === 2 || bgId === 3) {
            this.drawSprite(SPRITE_CONFIG.TRIGGERS.getSprite(bgId, this.state.colorTheme), drawX, drawY);
        } else if (bgId >= 11 && bgId <= 16) {
            this.drawSprite(SPRITE_CONFIG.COLOR_TRIGGERS.getSprite(bgId), drawX, drawY);
        } else if (bgId === 999) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.25;
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
            this.ctx.restore();
        }
    }

    drawForegroundTile(x, y, drawX, drawY, tick) {
        const id = this.state.gridForeground[x][y];
        if (id === 0) return;

        if (id === 2 || id === 7 || id === 8) {
            const moyou = this.state.gridTexture[x][y] || 0;
            this.drawSprite(SPRITE_CONFIG.WALLS.getSprite(this.state.colorTheme, moyou), drawX, drawY);

            if (id === 8) {
                const bgId = this.state.gridBackground[x][y];
                if (bgId > 0 && bgId < 200) {
                    this.drawSprite(SPRITE_CONFIG.HEARTS.getSprite(bgId, tick), drawX, drawY);
                }
            }
        } else if (id >= 400) {
            let lockColor = this.state.colorTheme;
            if (id >= 401 && id <= 405) lockColor = id - 400;
            else if (id === 416 || id === 419) lockColor = 6;
            this.drawSprite(SPRITE_CONFIG.WALLS.getSprite(lockColor, 26), drawX, drawY);
        } else if (id === 1) {
            if (this.state.gameStatus !== 2) {
                this.drawSprite(SPRITE_CONFIG.HEROINE.getSprite(this.state.playerForm, this.state.player.dir, tick), drawX, drawY);
            }
        } else if (id >= 11 && id <= 26) {
            if (id === 16 || (id >= 21 && id <= 26)) {
                this.drawSprite(SPRITE_CONFIG.ENEMIES.COLOR.getSprite(id, this.state.colorTheme, tick), drawX, drawY);
            } else if (id === 18) {
                this.drawSprite(SPRITE_CONFIG.ENEMIES.COLOR.getSprite(25, this.state.colorTheme, tick), drawX, drawY);
            } else if (id === 17) {
                this.drawSprite(SPRITE_CONFIG.ENEMIES.COLOR.getSprite(16, this.state.colorTheme, tick), drawX, drawY);
            } else {
                this.drawSprite(SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(id, tick), drawX, drawY);
            }
        } else if (id >= 100 && id <= 131) {
            this.drawSprite(SPRITE_CONFIG.HEARTS.getSprite(id, tick), drawX, drawY);
        }
    }

    updateLight(dt) {
        const target = this.state.gameStatus === 2 ? 0 : 0.7;
        if (this.state.lightLevel < target) {
            this.state.lightLevel = Math.min(target, this.state.lightLevel + dt * 2);
        } else if (this.state.lightLevel > target) {
            this.state.lightLevel = Math.max(target, this.state.lightLevel - dt);
        }

        // sun.cs pulse (triangular wave: 0→1→1→0, repeat every 3*warizan seconds)
        this.sunKosa += dt / this.sunWarizan;
        if (this.sunKosa >= 3) {
            this.sunJitterX = (Math.random() - 0.5) * 2 * 50;
            this.sunJitterY = (Math.random() - 0.5) * 2 * 10;
            this.sunKosa = 0;
        }
        if (this.sunKosa > 2) {
            this.sunAlpha = (3 - this.sunKosa) / 8;
        } else if (this.sunKosa > 1) {
            this.sunAlpha = 1 / 8;
        } else {
            this.sunAlpha = this.sunKosa / 8;
        }
    }

    drawLighting(tick) {
        if (this.state.lightLevel <= 0) return;

        const lightCtx = this.prepareLightCanvas();
        const ambientAlpha = 0.32 * this.state.lightLevel;
        lightCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        lightCtx.fillStyle = `rgba(0, 0, 0, ${ambientAlpha})`;
        lightCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        lightCtx.save();
        lightCtx.globalCompositeOperation = 'destination-out';
        this.drawPlayerSight(lightCtx);

        this.state.torches.forEach(torch => {
            const centerX = this.state.drawX(torch.x) + TILE_SIZE / 2;
            const centerY = this.state.drawY(torch.y) + TILE_SIZE / 2;
            const pulse = this.getTorchPulse(torch, 0.018);
            this.drawLightHole(lightCtx, centerX, centerY, TILE_SIZE * 3.6 * pulse, 0.68);
        });
        lightCtx.restore();

        this.ctx.drawImage(this.lightCanvas, 0, 0);
    }

    prepareLightCanvas() {
        if (this.lightCanvas.width !== this.canvas.width) this.lightCanvas.width = this.canvas.width;
        if (this.lightCanvas.height !== this.canvas.height) this.lightCanvas.height = this.canvas.height;
        return this.lightCtx;
    }

    drawPlayerSight(lightCtx) {
        const center = this.getPlayerLightCenter();
        // Main light hole (ugokulight equivalent)
        this.drawLightHole(lightCtx, center.x, center.y, TILE_SIZE * 5.0, 0.55);
        // Sun pulse (sun.cs equivalent) - subtle pulsing extra light
        if (this.sunAlpha > 0.004) {
            this.drawLightHole(lightCtx, center.x, center.y, TILE_SIZE * 1.8, this.sunAlpha * 4);
        }
    }

    drawLightHole(lightCtx, centerX, centerY, radius, strength) {
        const gradient = lightCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
        gradient.addColorStop(0.55, `rgba(0, 0, 0, ${strength * 0.48})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightCtx.fillStyle = gradient;
        lightCtx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }

    getTorchPulse(torch, amplitude) {
        const phaseOffset = torch.side === 'right' ? 0.65 : 0;
        return 1 + Math.sin(this.torchAnimTime * Math.PI * 0.85 + phaseOffset) * amplitude;
    }

    getPlayerLightCenter() {
        return {
            x: this.state.drawX(this.state.player.x) + TILE_SIZE / 2 + this.sunJitterX,
            y: this.state.drawY(this.state.player.y) + TILE_SIZE / 2 + this.sunJitterY
        };
    }

    drawTorches(tick) {
        this.state.torches.forEach(torch => {
            const x = this.state.drawX(torch.x);
            const y = this.state.drawY(torch.y);
            const flamePhase = Math.floor(this.torchAnimTime / 0.3) % 3;
            const wobbleSequence = torch.side === 'right' ? [1, 0, -1] : [-1, 0, 1];
            this.drawTorch(x, y, wobbleSequence[flamePhase]);
        });
    }

    drawTorch(x, y, flameOffsetX) {
        const base = SPRITE_CONFIG.TORCHES.getBaseSprite(this.state.colorTheme);
        const flame = SPRITE_CONFIG.TORCHES.getFlameSprite(this.state.colorTheme);
        this.drawSprite(base, x, y);

        const img = flame && this.images[flame.img];
        if (!img) return;

        this.ctx.drawImage(
            img,
            flame.x, flame.y, TILE_SIZE, 10,
            x + flameOffsetX, y, TILE_SIZE, 10
        );
    }

    drawCorpse() {
        if (this.state.gameStatus !== 2) return;

        const px = this.state.player.x;
        const py = this.state.player.y;
        const corpseConf = SPRITE_CONFIG.DEAD_BODY.getSprite(
            1,
            this.state.playerForm,
            this.state.player.dir,
            false
        );
        this.drawSprite(corpseConf, this.state.drawX(px), this.state.drawY(py));
    }

    drawEffects() {
        for (let i = this.state.effects.length - 1; i >= 0; i--) {
            const fx = this.state.effects[i];
            const frameIdx = Math.floor((Date.now() - fx.startTime) / 100);
            const drawX = this.state.drawX(fx.x);
            const drawY = this.state.drawY(fx.y);

            if (frameIdx < 2) {
                if (fx.type === 'DIE') {
                    this.drawSprite(SPRITE_CONFIG.DEAD_BODY.getSprite(
                        fx.id || 11,
                        fx.form || 1,
                        0,
                        fx.isCrushed,
                        fx.color || 0
                    ), drawX, drawY);
                }

                this.drawSprite(SPRITE_CONFIG.EXPLOSION.getSprite(fx.form, fx.isCrushed, frameIdx), drawX, drawY);
            } else {
                this.state.effects.splice(i, 1);
            }
        }
    }

    drawHandbook() {
        this.setPixelMode();
        const tick = this.state.animTick;
        this.state.animTick = (this.state.animTick + 1) % 60;

        const bgImg = this.images['assets/yuka.png'];
        if (bgImg) this.ctx.drawImage(bgImg, 0, 0);

        this.ctx.save();
        this.ctx.scale(2, 2);

        HB_LAYOUT.forEach((row, rIdx) => {
            row.forEach((item, cIdx) => {
                if (!item) return;

                const x = cIdx * TILE_SIZE;
                const y = rIdx * TILE_SIZE;
                let conf = null;

                if (item.id === 1) conf = SPRITE_CONFIG.HEROINE.getSprite(item.f, DIR.RIGHT, tick);
                else if (item.id >= 100 && item.id <= 131) conf = SPRITE_CONFIG.HEARTS.getSprite(item.id, tick);
                else if (item.id >= 11 && item.id <= 26 && !item.t) {
                    const mc = (item.id === 21) ? 1 : (item.id === 22) ? 2 : (item.id === 23) ? 3 : (item.id === 24) ? 4 : (item.id === 25) ? 6 : 0;
                    conf = (item.id === 16 || item.id >= 21)
                        ? SPRITE_CONFIG.ENEMIES.COLOR.getSprite(item.id, mc, tick)
                        : SPRITE_CONFIG.ENEMIES.SIMPLE.getSprite(item.id, tick);
                } else if (item.t === 'f') conf = SPRITE_CONFIG.COLOR_TRIGGERS.getSprite(item.id);
                else if (item.t === 't') conf = SPRITE_CONFIG.TRIGGERS.getSprite(item.id, 0);

                this.drawSprite(conf, x, y);

                if (ui.hbRow === rIdx && ui.hbCol === cIdx) {
                    this.ctx.strokeStyle = '#0f0';
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
                }
            });
        });

        this.ctx.restore();
    }

    drawSprite(conf, x, y) {
        if (!conf || !this.images[conf.img]) return;

        this.ctx.drawImage(
            this.images[conf.img],
            conf.x, conf.y, TILE_SIZE, TILE_SIZE,
            x, y, TILE_SIZE, TILE_SIZE
        );
    }
}
