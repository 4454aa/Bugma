class MovementLogic {
    constructor(gameState, battleLogic) {
        this.state = gameState;
        this.battle = battleLogic;
        this.lastActionTime = 0;
    }

    processMoveInput(dx, dy) {
        if (this.state.gameStatus !== 0) return;

        if (!this.state.isReplayMode) {
            const now = Date.now();
            if (now - this.lastActionTime < 100) return;
            this.lastActionTime = now;
        }

        const oldDir = this.state.player.dir;
        let newDir = oldDir;
        let action = 0;

        if (dy === 1) {
            newDir = DIR.RIGHT;
            action = 1;
        } else if (dy === -1) {
            newDir = DIR.LEFT;
            action = 4;
        } else if (dx === -1) {
            newDir = DIR.LEFT;
            action = 2;
        } else if (dx === 1) {
            newDir = DIR.RIGHT;
            action = 3;
        }

        this.state.saveSnapshot();
        this.state.syncMainToBuffer();
        this.state.player.dir = newDir;
        if (dx !== 0 || dy !== 0) this.state.viewVector = { dx, dy };

        let transformed = false;
        if (this.state.playerForm === 2 && oldDir !== newDir) {
            transformed = this.processHpHanten();
        }

        let moved = false;
        if (action === 1) moved = this.moveUp();
        else if (action === 2) moved = this.moveLeft();
        else if (action === 3) moved = this.moveRight();
        else if (action === 4) moved = this.moveDown();

        if (moved || transformed) {
            this.state.stepCount++;

            if (!this.state.isReplayMode) {
                if (dy === 1) this.state.replayString += 'U';
                else if (dy === -1) this.state.replayString += 'D';
                else if (dx === -1) this.state.replayString += 'L';
                else if (dx === 1) this.state.replayString += 'R';
            }

            if (moved) {
                this.applyColorFloor();
                this.checkFloorTrigger();
            }

            this.checkWinLoss();
            this.state.syncBufferToMain();
        } else {
            this.state.restoreSnapshot();
        }
    }

    moveUp() {
        const { x: hx, y: hy } = this.state.player;
        if (hy >= this.state.lastY()) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 0, 1);

        const targetId = this.state.gridBuffer[hx][hy + 1];
        if (targetId === ID.EMPTY) {
            this.shiftHeartStack(hx, hy + 1, 0, 1);
            this.movePlayerTo(hx, hy + 1);
            return true;
        }
        if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx, hy + 1, 0, 1);
            return true;
        }
        return false;
    }

    moveDown() {
        const { x: hx, y: hy } = this.state.player;
        if (hy <= 0) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 0, -1);

        const targetId = this.state.gridBuffer[hx][hy - 1];
        if (targetId === ID.EMPTY) {
            this.movePlayerTo(hx, hy - 1);
            this.shiftHeartStack(hx, hy + 1, 0, -1);
            return true;
        }
        if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx, hy - 1, 0, -1);
            return true;
        }
        return false;
    }

    moveLeft() {
        const { x: hx, y: hy } = this.state.player;
        if (hx <= 0) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, -1, 0);

        const targetId = this.state.gridBuffer[hx - 1][hy];
        if (targetId === ID.EMPTY) {
            this.movePlayerTo(hx - 1, hy);
            this.shiftHeartStack(hx, hy + 1, -1, 0);
            return true;
        }
        if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx - 1, hy, -1, 0);
            return true;
        }
        return false;
    }

    moveRight() {
        const { x: hx, y: hy } = this.state.player;
        if (hx >= this.state.lastX()) return false;
        if (this.state.playerForm === 1) this.processPush(hx, hy, 1, 0);

        const targetId = this.state.gridBuffer[hx + 1][hy];
        if (targetId === ID.EMPTY) {
            this.movePlayerTo(hx + 1, hy);
            this.shiftHeartStack(hx, hy + 1, 1, 0);
            return true;
        }
        if (this.isEnemy(targetId)) {
            this.battle.resolveCombat(hx + 1, hy, 1, 0);
            return true;
        }
        return false;
    }

    movePlayerTo(x, y) {
        const oldX = this.state.player.x;
        const oldY = this.state.player.y;
        this.state.gridBuffer[x][y] = 1;
        this.state.gridBuffer[oldX][oldY] = 0;
        this.state.player.x = x;
        this.state.player.y = y;
    }

    shiftHeartStack(sourceX, startY, dx, dy) {
        let stackY = startY;
        let hpichi = 0;

        while (stackY < this.state.gridHeight) {
            const id = this.state.gridForeground[sourceX][stackY];
            if (!this.isHeart(id)) break;

            const type = Math.floor(id / 10);
            if (hpichi === 2 && type !== 10) break;
            if (hpichi === 1 && type !== 11) break;
            if (hpichi === 3 && type !== 12) break;
            if (hpichi === 4 && id !== 131) break;

            const targetX = sourceX + dx;
            const targetY = stackY + dy;
            if (!this.state.inBounds(targetX, targetY) || this.state.gridBuffer[targetX][targetY] !== 0) break;

            this.state.gridBuffer[targetX][targetY] = id;
            this.state.gridBuffer[sourceX][stackY] = 0;

            if (id === 103) hpichi = 2;
            else if (id === 113) hpichi = 1;
            else if (id === 123) hpichi = 3;
            else if (id === 131) hpichi = 4;
            else break;

            stackY++;
        }
    }

    processHpHanten() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        let hpy = py + 1;
        let hpichi = 0;
        let hasChanged = false;

        while (hpy < this.state.gridHeight) {
            const id = this.state.gridForeground[px][hpy];

            if (!this.isHeart(id) || id === 131) break;
            if (id >= 101 && id <= 103) break;

            if (id === 123 && hpichi !== 1) {
                this.applyHanten(px, hpy, 113);
                hpichi = 3;
                hasChanged = true;
                hpy++;
                continue;
            }
            if (id === 113 && hpichi !== 3) {
                this.applyHanten(px, hpy, 123);
                hpichi = 1;
                hasChanged = true;
                hpy++;
                continue;
            }
            if (id === 122 && hpichi !== 1) {
                this.applyHanten(px, hpy, 112);
                return true;
            }
            if (id === 121 && hpichi !== 1) {
                this.applyHanten(px, hpy, 111);
                return true;
            }
            if (id === 112 && hpichi !== 3) {
                this.applyHanten(px, hpy, 122);
                return true;
            }
            if (id === 111 && hpichi !== 3) {
                this.applyHanten(px, hpy, 121);
                return true;
            }

            break;
        }

        return hasChanged;
    }

    applyHanten(x, y, newId) {
        this.state.gridBuffer[x][y] = newId;
        this.state.gridForeground[x][y] = newId;
    }

    applyColorFloor() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        const floorId = this.state.gridBackground[px][py];

        if (floorId >= 11 && floorId <= 16) {
            const targetColor = floorId - 10;
            if (this.state.colorTheme !== targetColor) {
                this.state.colorTheme = targetColor;
            }
        }
    }

    checkFloorTrigger() {
        const px = this.state.player.x;
        const py = this.state.player.y;
        const floorId = this.state.gridBackground[px][py];

        if (floorId !== 2 && floorId !== 3) return;

        if (this.state.currentStageId === "93" && this.state.gridBuffer[3]?.[1] !== 26) {
            return;
        }

        if (floorId === 2 && this.state.playerForm !== 1) {
            this.state.playerForm = 1;
            if (window.updateFavicon) window.updateFavicon(1);
        } else if (floorId === 3 && this.state.playerForm !== 2) {
            this.state.playerForm = 2;
            if (window.updateFavicon) window.updateFavicon(2);
        }
    }

    processPush(startX, startY, dx, dy) {
        let pushX = startX + dx;
        let pushY = startY + dy;
        let canPush = false;

        while (this.isValid(pushX, pushY)) {
            const id = this.state.gridForeground[pushX][pushY];
            if (id === ID.EMPTY) {
                canPush = true;
                break;
            }
            if (!this.isPushable(id)) break;
            pushX += dx;
            pushY += dy;
        }

        if (!canPush) return;

        while (pushX !== startX + dx || pushY !== startY + dy) {
            const prevX = pushX - dx;
            const prevY = pushY - dy;
            this.state.gridBuffer[pushX][pushY] = this.state.gridForeground[prevX][prevY];
            pushX = prevX;
            pushY = prevY;
        }
        this.state.gridBuffer[pushX][pushY] = 0;
    }

    checkWinLoss() {
        if (this.state.gameStatus !== 0) return;

        let playerFound = false;
        let enemyExists = false;
        let px = -1;
        let py = -1;

        this.state.forEachCell((x, y) => {
            const id = this.state.gridBuffer[x][y];

            if (id === 1) {
                playerFound = true;
                px = x;
                py = y;
            }

            if (this.isEnemy(id)) {
                const hasHeart = y < this.state.lastY() && this.isHeart(this.state.gridBuffer[x][y + 1]);

                if (id === 17 || id === 18) {
                    enemyExists = true;
                    if (hasHeart) this.state.gridBuffer[x][y] = id === 18 ? 25 : 16;
                } else if (hasHeart) {
                    enemyExists = true;
                } else {
                    this.state.gridBuffer[x][y] = 0;
                    this.state.effects.push({
                        x, y, startTime: Date.now(),
                        type: 'DIE', id, form: this.state.playerForm, isCrushed: true,
                        color: this.state.colorTheme
                    });
                }
            }
        });

        if (playerFound) {
            const hasHeart = py < this.state.lastY() && this.isHeart(this.state.gridBuffer[px][py + 1]);
            if (this.state.isInvincible === 1) {
                if (hasHeart) this.state.isInvincible = 0;
            } else if (!hasHeart) {
                this.state.gridBuffer[px][py] = 0;
                playerFound = false;
                this.state.gameStatus = 2;
                this.state.effects.push({
                    x: px, y: py, startTime: Date.now(),
                    type: 'DIE', id: 1, form: this.state.playerForm, isCrushed: true
                });
            }
        } else {
            this.state.gameStatus = 2;
        }

        if (this.state.gameStatus === 0 && !enemyExists) {
            this.state.gameStatus = 1;
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
        let hasChanged = false;

        while (hpy < this.state.gridHeight) {
            const id = this.state.gridBuffer[px][hpy];
            if (!this.isHeart(id) || id === 131) break;
            if (id >= 101 && id <= 103) break;

            const currentPrefix = Math.floor(id / 10);
            const hp = id % 10;
            if (currentPrefix !== targetPrefix) hasChanged = true;

            if (hp === 3) {
                this.state.gridBuffer[px][hpy] = targetPrefix * 10 + 3;
                if (hpy + 1 < this.state.gridHeight) {
                    const nextId = this.state.gridBuffer[px][hpy + 1];
                    if (this.isHeart(nextId) && nextId !== 131 && Math.floor(nextId / 10) !== currentPrefix) {
                        return hasChanged;
                    }
                }
                hpy++;
                continue;
            }

            if (hp === 2 || hp === 1) {
                this.state.gridBuffer[px][hpy] = targetPrefix * 10 + hp;
                return true;
            }

            break;
        }

        return hasChanged;
    }

    isValid(x, y) {
        return this.state.inBounds(x, y);
    }

    isPushable(id) {
        return (id >= 100 && id <= 399) || id >= 400;
    }

    isEnemy(id) {
        return id >= 11 && id <= 26;
    }

    isHeart(id) {
        return id >= 101 && id <= 200;
    }
}
