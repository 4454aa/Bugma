class VisualLogic {
    constructor(gameState) {
        this.state = gameState;
    }

    isWall(x, y) {
        if (!this.state.inBounds(x, y)) return false;
        const id = this.state.gridForeground[x][y];
        return id === 2 || id === 8;
    }

    isOpenOrMaskedWall(x, y) {
        if (!this.state.inBounds(x, y)) return true;
        const moyou = this.state.gridTexture[x][y];
        return !this.isWall(x, y) || moyou === 26 || moyou === 1 || moyou === 2;
    }

    updateAutoTiling() {
        const tex = this.state.gridTexture;
        const lastX = this.state.lastX();
        const lastY = this.state.lastY();

        this.state.forEachCell((x, y) => {
            tex[x][y] = 0;
        });

        for (let x = 0; x <= lastX; x++) {
            for (let y = 0; y <= lastY; y++) {
                if (!this.isWall(x, y)) continue;

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

                if (x < lastX) {
                    if (y > 1 && !this.isWall(x + 1, y - 2)) this.setRightEdge(tex, x, y);
                    if (y > 0 && !this.isWall(x + 1, y - 1)) this.setRightEdge(tex, x, y);
                    if (!this.isWall(x + 1, y)) this.setRightEdge(tex, x, y);
                }

                if (x > 0) {
                    if (y > 1 && !this.isWall(x - 1, y - 2)) this.setLeftEdge(tex, x, y);
                    if (y > 0 && !this.isWall(x - 1, y - 1)) this.setLeftEdge(tex, x, y);
                    if (!this.isWall(x - 1, y)) this.setLeftEdge(tex, x, y);
                }

                if (y < lastY && !this.isWall(x, y + 1)) {
                    this.setBottomEdge(tex, x, y);
                }

                if (x < lastX && y > 2 && !this.isWall(x + 1, y - 3) && tex[x][y] === 0) {
                    tex[x][y] = 8;
                }
                if (x > 0 && y > 2 && !this.isWall(x - 1, y - 3)) {
                    if (tex[x][y] === 0) tex[x][y] = 7;
                    else if (tex[x][y] === 8) tex[x][y] = 22;
                }
                if (x < lastX && y < lastY && !this.isWall(x + 1, y + 1)) {
                    if (tex[x][y] === 0) tex[x][y] = 10;
                    else if (tex[x][y] === 8) tex[x][y] = 25;
                }
                if (x > 0 && y < lastY && !this.isWall(x - 1, y + 1)) {
                    if (tex[x][y] === 0) tex[x][y] = 9;
                    else if (tex[x][y] === 10) tex[x][y] = 23;
                    else if (tex[x][y] === 7) tex[x][y] = 24;
                }
            }
        }

        this.applyMaskPass(lastY);
        this.applyCornerPass(lastX, lastY);
        this.updateTorches();
    }

    setRightEdge(tex, x, y) {
        if (tex[x][y] === 0) tex[x][y] = 4;
        else if (tex[x][y] === 3) tex[x][y] = 14;
    }

    setLeftEdge(tex, x, y) {
        if (tex[x][y] === 0) tex[x][y] = 5;
        else if (tex[x][y] === 3) tex[x][y] = 13;
        else if (tex[x][y] === 4) tex[x][y] = 18;
        else if (tex[x][y] === 14) tex[x][y] = 15;
    }

    setBottomEdge(tex, x, y) {
        if (tex[x][y] === 0) tex[x][y] = 6;
        else if (tex[x][y] === 3) tex[x][y] = 21;
        else if (tex[x][y] === 4) tex[x][y] = 11;
        else if (tex[x][y] === 5) tex[x][y] = 12;
        else if (tex[x][y] === 13) tex[x][y] = 17;
        else if (tex[x][y] === 14) tex[x][y] = 16;
        else if (tex[x][y] === 15) tex[x][y] = 20;
        else if (tex[x][y] === 18) tex[x][y] = 19;
    }

    applyMaskPass(lastY) {
        const tex = this.state.gridTexture;

        this.state.forEachCell((x, y) => {
            if (y < lastY && !this.isWall(x, y + 1)) {
                if (y > 1 && !this.isWall(x, y - 2)) tex[x][y] = 26;
                if (y > 0 && !this.isWall(x, y - 1)) tex[x][y] = 26;
            }

            if (y < lastY - 1 && !this.isWall(x, y + 2) && y > 0 && !this.isWall(x, y - 1)) {
                tex[x][y] = 26;
            }
        });
    }

    applyCornerPass(lastX, lastY) {
        const tex = this.state.gridTexture;

        for (let x = 0; x <= lastX; x++) {
            for (let y = 0; y <= lastY; y++) {
                const current = tex[x][y];

                if (x > 0 && y < lastY && this.isOpenOrMaskedWall(x - 1, y + 1)) {
                    if (current === 45) tex[x][y] = 47;
                    else if (current === 3) tex[x][y] = 46;
                    else if (current === 14) tex[x][y] = 44;
                    else if (current === 35) tex[x][y] = 42;
                    else if (current === 39) tex[x][y] = 41;
                    else if (current === 4) tex[x][y] = 37;
                    else if (current === 22) tex[x][y] = 34;
                    else if (current === 8) tex[x][y] = 48;
                    else if (current === 49) tex[x][y] = 27;
                }

                if (x < lastX && y < lastY && this.isOpenOrMaskedWall(x + 1, y + 1)) {
                    if (current === 46) tex[x][y] = 47;
                    else if (current === 3) tex[x][y] = 45;
                    else if (current === 13) tex[x][y] = 43;
                    else if (current === 34) tex[x][y] = 42;
                    else if (current === 36) tex[x][y] = 40;
                    else if (current === 5) tex[x][y] = 38;
                    else if (current === 22) tex[x][y] = 35;
                    else if (current === 24) tex[x][y] = 27;
                    else if (current === 7) tex[x][y] = 49;
                }

                if (x < lastX && y > 0 && this.isOpenOrMaskedWall(x + 1, y - 1)) {
                    if (current === 31) tex[x][y] = 33;
                    else if (current === 6) tex[x][y] = 32;
                    else if (current === 12) tex[x][y] = 29;
                    else if (current === 27) tex[x][y] = 42;
                    else if (current === 38) tex[x][y] = 40;
                    else if (current === 5) tex[x][y] = 36;
                    else if (current === 49) tex[x][y] = 35;
                    else if (current === 23) tex[x][y] = 28;
                    else if (current === 9) tex[x][y] = 48;
                }

                if (x > 0 && y > 0 && this.isOpenOrMaskedWall(x - 1, y - 1)) {
                    if (current === 32) tex[x][y] = 33;
                    else if (current === 6) tex[x][y] = 31;
                    else if (current === 11) tex[x][y] = 30;
                    else if (current === 28) tex[x][y] = 42;
                    else if (current === 37) tex[x][y] = 41;
                    else if (current === 4) tex[x][y] = 39;
                    else if (current === 48) tex[x][y] = 34;
                    else if (current === 23) tex[x][y] = 27;
                    else if (current === 10) tex[x][y] = 49;
                }
            }
        }
    }

    updateTorches() {
        const torchColumns = [5, 8];
        this.clearTorchBackgrounds();
        this.state.torches = [];

        torchColumns.forEach((x, index) => {
            if (x >= this.state.gridWidth) return;

            for (let y = this.state.lastY(); y >= 0; y--) {
                if (this.state.gridForeground[x][y] !== 2) {
                    const torchY = y + 1;
                    if (torchY >= 0 && torchY < this.state.gridHeight) {
                        this.state.torchBackgroundCells.push({
                            x,
                            y: torchY,
                            previous: this.state.gridBackground[x][torchY]
                        });
                        this.state.gridBackground[x][torchY] = 999;
                        this.state.torches.push({ x, y: torchY, side: index === 0 ? 'left' : 'right' });
                    }
                    break;
                }
            }
        });
    }

    clearTorchBackgrounds() {
        if (!this.state.torchBackgroundCells) this.state.torchBackgroundCells = [];

        this.state.torchBackgroundCells.forEach(cell => {
            if (this.state.inBounds(cell.x, cell.y) && this.state.gridBackground[cell.x][cell.y] === 999) {
                this.state.gridBackground[cell.x][cell.y] = cell.previous || 0;
            }
        });

        this.state.torchBackgroundCells = [];
    }
}
